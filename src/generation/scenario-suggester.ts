/**
 * ScenarioSuggester — suggests dramatic events for a relationship graph.
 *
 * Analyzes the graph for hotspots (high tension, near migration thresholds,
 * stagnation, power imbalances) and generates candidate events with
 * pre-computed impact and drama potential.
 */

import type {
  RelationshipGraph,
} from '../graph/relationship-graph.js';
import type {
  Relationship,
  MigrationRule,
} from '../schema/types.js';
import { resolveTemplate } from '../templates/registry.js';

export interface SuggestOptions {
  /** Focus on specific agents */
  agentIds?: string[];
  /** Event type filter */
  eventTypes?: string[];
  /** Minimum drama potential (0-1) to include */
  minDrama?: number;
}

export interface SuggestedEvent {
  /** Event type string */
  eventType: string;
  /** Source agent */
  from: string;
  /** Target agent */
  to: string;
  /** Pre-computed expected impact */
  expectedImpact: Record<string, number>;
  /** Drama potential score (0-1) */
  dramaPotential: number;
  /** Human-readable reason why this event is interesting */
  reason: string;
  /** If this event would likely trigger a migration */
  wouldTriggerMigration?: {
    fromTemplate: string;
    toTemplate: string;
  };
}

export class ScenarioSuggester {
  constructor(private graph: RelationshipGraph) {}

  /** Suggest interesting events for the current graph state */
  suggest(count = 5, options?: SuggestOptions): SuggestedEvent[] {
    const candidates: SuggestedEvent[] = [];
    const rels = this.getFilteredRelationships(options);

    for (const rel of rels) {
      // Detect hotspot types
      candidates.push(...this.detectTensionEvents(rel));
      candidates.push(...this.detectMigrationEdgeEvents(rel));
      candidates.push(...this.detectStagnationEvents(rel));
      candidates.push(...this.detectPowerImbalanceEvents(rel));
    }

    // Apply minimum drama filter
    const minDrama = options?.minDrama ?? 0;
    const filtered = candidates.filter(c => c.dramaPotential >= minDrama);

    // Sort by drama potential descending, take top N
    filtered.sort((a, b) => b.dramaPotential - a.dramaPotential);

    // Deduplicate by from+to+eventType
    const seen = new Set<string>();
    const unique: SuggestedEvent[] = [];
    for (const c of filtered) {
      const key = `${c.from}:${c.to}:${c.eventType}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }

    return unique.slice(0, count);
  }

  /** High tension: trust and rivalry both elevated */
  private detectTensionEvents(rel: Relationship): SuggestedEvent[] {
    const results: SuggestedEvent[] = [];
    const trust = rel.dimensions.find(d => d.type === 'trust');
    const rivalry = rel.dimensions.find(d => d.type === 'rivalry');

    if (trust && rivalry && trust.value > 0.2 && rivalry.value > 0.4) {
      const drama = (trust.value + rivalry.value) / 2;

      results.push({
        eventType: 'alliance.betrayed',
        from: rel.from,
        to: rel.to,
        expectedImpact: { trust: -0.4, loyalty: -0.5 },
        dramaPotential: Math.min(1, drama * 1.2),
        reason: `High trust (${trust.value.toFixed(2)}) + rivalry (${rivalry.value.toFixed(2)}) = volatile alliance, betrayal would be devastating`,
      });

      results.push({
        eventType: 'unexpected_help',
        from: rel.from,
        to: rel.to,
        expectedImpact: { rivalry: -0.15, trust: 0.2 },
        dramaPotential: Math.min(1, drama * 0.9),
        reason: `Unexpected help could de-escalate tense rival-ally dynamic`,
      });
    }

    return results;
  }

  /** Near migration threshold: small push could change relationship type */
  private detectMigrationEdgeEvents(rel: Relationship): SuggestedEvent[] {
    const results: SuggestedEvent[] = [];

    for (const tag of rel.tags ?? []) {
      const template = resolveTemplate(tag);
      if (!template?.migrations) continue;

      for (const migration of template.migrations) {
        const proximity = this.migrationProximity(rel, migration);

        if (proximity > 0.5 && proximity < 1.0) {
          // Close to migrating — suggest events that would push it over
          const pushEvent = this.findPushEvent(rel, template.rules, migration);
          if (pushEvent) {
            results.push({
              ...pushEvent,
              dramaPotential: Math.min(1, proximity * 1.3),
              reason: `${tag} → ${migration.targetTemplate} migration at ${(proximity * 100).toFixed(0)}% — one event could trigger it`,
              wouldTriggerMigration: {
                fromTemplate: tag,
                toTemplate: migration.targetTemplate,
              },
            });
          }
        }
      }
    }

    return results;
  }

  /** Stagnation: relationship hasn't changed in a while */
  private detectStagnationEvents(rel: Relationship): SuggestedEvent[] {
    const results: SuggestedEvent[] = [];
    const interactionCount = rel.memory.longTerm.interactionCount;

    if (interactionCount < 2) {
      // Get relevant events from templates
      for (const tag of rel.tags ?? []) {
        const template = resolveTemplate(tag);
        if (!template) continue;

        const firstRule = template.rules[0];
        if (firstRule) {
          results.push({
            eventType: firstRule.on,
            from: rel.from,
            to: rel.to,
            expectedImpact: firstRule.adjust,
            dramaPotential: 0.3,
            reason: `Stagnant relationship (${interactionCount} interactions) — needs activity`,
          });
        }
      }
    }

    return results;
  }

  /** Power imbalance: authority very skewed */
  private detectPowerImbalanceEvents(rel: Relationship): SuggestedEvent[] {
    const results: SuggestedEvent[] = [];
    const authority = rel.dimensions.find(d => d.type === 'authority');
    const trust = rel.dimensions.find(d => d.type === 'trust');

    if (authority && Math.abs(authority.value) > 0.7 && trust && trust.value < 0.3) {
      results.push({
        eventType: 'conflict.escalated',
        from: authority.value < 0 ? rel.from : rel.to, // subordinate escalates
        to: authority.value < 0 ? rel.to : rel.from,
        expectedImpact: { trust: -0.15, authority: -0.1 },
        dramaPotential: Math.min(1, Math.abs(authority.value) * 0.8),
        reason: `High authority imbalance (${authority.value.toFixed(2)}) with low trust (${trust.value.toFixed(2)}) — ripe for rebellion`,
      });
    }

    return results;
  }

  /** Calculate how close a relationship is to triggering a migration (0=far, 1=triggered) */
  private migrationProximity(rel: Relationship, migration: MigrationRule): number {
    if (migration.when.length === 0) return 0;

    let totalProximity = 0;
    for (const condition of migration.when) {
      const dim = rel.dimensions.find(d => d.type === condition.dimension);
      if (!dim) return 0;

      if (condition.operator === 'below') {
        // How close is dim.value to going below threshold?
        if (dim.value < condition.value) {
          totalProximity += 1;
        } else {
          const range = Math.max(1, dim.value - condition.value + 0.5);
          totalProximity += 0.5 / range;
        }
      } else {
        // 'above'
        if (dim.value > condition.value) {
          totalProximity += 1;
        } else {
          const range = Math.max(1, condition.value - dim.value + 0.5);
          totalProximity += 0.5 / range;
        }
      }
    }

    return totalProximity / migration.when.length;
  }

  /** Find a template rule event that would push toward migration */
  private findPushEvent(
    rel: Relationship,
    rules: Array<{ on: string; adjust: Record<string, number> }>,
    migration: MigrationRule
  ): Omit<SuggestedEvent, 'dramaPotential' | 'reason' | 'wouldTriggerMigration'> | null {
    for (const rule of rules) {
      // Check if this rule pushes dimensions toward the migration conditions
      let helpfulDimensions = 0;
      for (const condition of migration.when) {
        const delta = rule.adjust[condition.dimension];
        if (delta === undefined) continue;

        if (condition.operator === 'below' && delta < 0) helpfulDimensions++;
        if (condition.operator === 'above' && delta > 0) helpfulDimensions++;
      }

      if (helpfulDimensions > 0) {
        return {
          eventType: rule.on,
          from: rel.from,
          to: rel.to,
          expectedImpact: rule.adjust,
        };
      }
    }
    return null;
  }

  /** Get relationships filtered by options */
  private getFilteredRelationships(options?: SuggestOptions): Relationship[] {
    let rels = this.graph.getAllRelationships();

    if (options?.agentIds?.length) {
      const agentSet = new Set(options.agentIds);
      rels = rels.filter(r => agentSet.has(r.from) || agentSet.has(r.to));
    }

    return rels;
  }
}
