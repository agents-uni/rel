/**
 * Evolution Engine — applies events to relationships using template rules.
 *
 * The engine matches incoming events against relationship templates'
 * evolution rules, computes dimension deltas, and applies them through
 * the graph's event-sourced pipeline.
 *
 * Pipeline (post-enhancement):
 * 1. Find relationships between agents
 * 2. Collect rules from templates + global rules → totalAdjust
 * 3. If totalAdjust is empty → resolveImpactFromTemplates() fills defaults
 * 4. applyTraitModifiers() — use agent traits to adjust deltas
 * 5. Create event → graph.applyEvent()
 * 6. checkMigration() — check if relationship type should transition
 * 7. Return EvolutionResult (+ optional migration info)
 */

import type { RelationshipEvent, EvolutionRule, TraitRegistry } from '../schema/types.js';
import type { RelationshipGraph } from '../graph/relationship-graph.js';
import { resolveTemplate } from '../templates/registry.js';
import { applyTraitModifiers } from './trait-modifier.js';
import { resolveImpactFromTemplates } from './impact-resolver.js';
import { checkMigration, executeMigration } from './migration.js';
import type { MigrationResult } from './migration.js';

export interface EvolutionResult {
  relationshipId: string;
  from: string;
  to: string;
  appliedRules: string[];
  dimensionChanges: Record<string, { before: number; after: number }>;
  /** If a migration was triggered, this field describes it */
  migration?: MigrationResult;
}

export interface EvolutionEngineOptions {
  /** Agent trait registry for trait-aware evolution */
  traits?: TraitRegistry;
  /** Callback invoked when a relationship type migrates */
  onMigration?: (result: MigrationResult, relationshipId: string) => void;
}

/** Check if an event type matches a rule's "on" pattern (supports glob) */
function matchesEventType(eventType: string, rulePattern: string): boolean {
  if (rulePattern === eventType) return true;
  if (rulePattern === '*') return true;

  // Simple glob: "task.*" matches "task.completed_well"
  if (rulePattern.endsWith('.*')) {
    const prefix = rulePattern.slice(0, -2);
    return eventType.startsWith(prefix + '.');
  }

  return false;
}

export class EvolutionEngine {
  /** Custom rules applied to all relationships (in addition to template rules) */
  private globalRules: EvolutionRule[] = [];
  private traitRegistry: TraitRegistry;
  private onMigration?: (result: MigrationResult, relationshipId: string) => void;

  constructor(private graph: RelationshipGraph, options?: EvolutionEngineOptions) {
    this.traitRegistry = options?.traits ?? {};
    this.onMigration = options?.onMigration;
  }

  /** Add a global evolution rule that applies to all relationships */
  addGlobalRule(rule: EvolutionRule): void {
    this.globalRules.push(rule);
  }

  /** Update the trait registry (e.g., when new agents are loaded) */
  setTraitRegistry(traits: TraitRegistry): void {
    this.traitRegistry = traits;
  }

  /** Get the current trait registry */
  getTraitRegistry(): TraitRegistry {
    return this.traitRegistry;
  }

  /**
   * Process an event that occurred between two agents.
   * Finds applicable rules from templates + global rules, computes
   * adjustments, and applies them through the graph's event pipeline.
   */
  processEvent(
    fromId: string,
    toId: string,
    eventType: string,
    options?: { description?: string; source?: string; metadata?: Record<string, unknown> }
  ): EvolutionResult[] {
    const results: EvolutionResult[] = [];
    const rels = this.graph.getBetween(fromId, toId);

    for (const rel of rels) {
      const appliedRules: string[] = [];
      let totalAdjust: Record<string, number> = {};

      // Step 2: Collect rules from all dimension templates
      const seenTemplates = new Set<string>();
      for (const dim of rel.dimensions) {
        if (seenTemplates.has(dim.type)) continue;
        seenTemplates.add(dim.type);

        const template = resolveTemplate(dim.type);
        if (template) {
          for (const rule of template.rules) {
            if (matchesEventType(eventType, rule.on)) {
              for (const [dimType, delta] of Object.entries(rule.adjust)) {
                totalAdjust[dimType] = (totalAdjust[dimType] ?? 0) + delta;
              }
              appliedRules.push(rule.description ?? `${rule.on} → ${JSON.stringify(rule.adjust)}`);
            }
          }
        }
      }

      // Also check relationship tags for template matching
      for (const tag of rel.tags ?? []) {
        if (seenTemplates.has(tag)) continue;
        seenTemplates.add(tag);

        const template = resolveTemplate(tag);
        if (template) {
          for (const rule of template.rules) {
            if (matchesEventType(eventType, rule.on)) {
              for (const [dimType, delta] of Object.entries(rule.adjust)) {
                totalAdjust[dimType] = (totalAdjust[dimType] ?? 0) + delta;
              }
              appliedRules.push(rule.description ?? `[tag:${tag}] ${rule.on}`);
            }
          }
        }
      }

      // Apply global rules
      for (const rule of this.globalRules) {
        if (matchesEventType(eventType, rule.on)) {
          for (const [dimType, delta] of Object.entries(rule.adjust)) {
            totalAdjust[dimType] = (totalAdjust[dimType] ?? 0) + delta;
          }
          appliedRules.push(rule.description ?? `[global] ${rule.on}`);
        }
      }

      // Step 3: If totalAdjust is empty, resolve from templates
      if (Object.keys(totalAdjust).length === 0) {
        totalAdjust = resolveImpactFromTemplates(eventType, rel);
        if (Object.keys(totalAdjust).length > 0) {
          appliedRules.push(`[auto-resolved] impact from templates for ${eventType}`);
        }
      }

      if (Object.keys(totalAdjust).length === 0) continue;

      // Step 4: Apply trait modifiers
      if (Object.keys(this.traitRegistry).length > 0) {
        totalAdjust = applyTraitModifiers(
          totalAdjust,
          fromId,
          toId,
          eventType,
          this.traitRegistry,
        );
      }

      // Record before values
      const dimensionChanges: Record<string, { before: number; after: number }> = {};
      for (const dimType of Object.keys(totalAdjust)) {
        const dim = rel.dimensions.find(d => d.type === dimType);
        dimensionChanges[dimType] = { before: dim?.value ?? 0, after: 0 };
      }

      // Step 5: Apply through event pipeline
      const event: RelationshipEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        type: eventType,
        participants: [fromId, toId],
        impact: totalAdjust,
        description: options?.description,
        source: options?.source,
        metadata: options?.metadata,
      };

      this.graph.applyEvent(rel.id, event);

      // Record after values
      for (const dimType of Object.keys(totalAdjust)) {
        const dim = rel.dimensions.find(d => d.type === dimType);
        dimensionChanges[dimType].after = dim?.value ?? 0;
      }

      // Step 6: Check for migration
      let migration: MigrationResult | undefined;
      const migrationCheck = checkMigration(rel);
      if (migrationCheck) {
        migration = executeMigration(rel, migrationCheck.sourceTemplate, migrationCheck.rule.targetTemplate);
        if (migration.migrated && migration.migrationEvent) {
          // Record migration event in relationship memory
          this.graph.applyEvent(rel.id, migration.migrationEvent);
          // Invoke callback
          this.onMigration?.(migration, rel.id);
        }
      }

      results.push({
        relationshipId: rel.id,
        from: rel.from,
        to: rel.to,
        appliedRules,
        dimensionChanges,
        migration,
      });
    }

    return results;
  }

  /**
   * Process a multi-agent event (e.g., group collaboration).
   * Applies pairwise between all participants.
   */
  processGroupEvent(
    agentIds: string[],
    eventType: string,
    options?: { description?: string; source?: string }
  ): EvolutionResult[] {
    const results: EvolutionResult[] = [];

    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const r1 = this.processEvent(agentIds[i], agentIds[j], eventType, options);
        const r2 = this.processEvent(agentIds[j], agentIds[i], eventType, options);
        results.push(...r1, ...r2);
      }
    }

    return results;
  }
}
