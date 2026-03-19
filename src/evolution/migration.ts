/**
 * Migration — automatic relationship type transitions.
 *
 * When a relationship's dimensions cross certain thresholds,
 * the relationship can automatically migrate from one template
 * to another (e.g., ally → rival when trust drops below -0.2).
 */

import type {
  Relationship,
  MigrationRule,
  MigrationCondition,
  RelationshipEvent,
  Dimension,
  DimensionSeed,
} from '../schema/types.js';
import { resolveTemplate } from '../templates/registry.js';

/** Result of a migration check */
export interface MigrationResult {
  /** Whether a migration occurred */
  migrated: boolean;
  /** Source template name (if migrated) */
  fromTemplate?: string;
  /** Target template name (if migrated) */
  toTemplate?: string;
  /** The system event recorded for the migration */
  migrationEvent?: RelationshipEvent;
}

/**
 * Check if a relationship should migrate based on current dimension values.
 *
 * Scans the relationship's tags for templates with migration rules,
 * then checks if ALL conditions in any rule are satisfied.
 */
export function checkMigration(relationship: Relationship): { rule: MigrationRule; sourceTemplate: string } | null {
  for (const tag of relationship.tags ?? []) {
    const template = resolveTemplate(tag);
    if (!template?.migrations) continue;

    for (const migration of template.migrations) {
      if (allConditionsMet(relationship, migration.when)) {
        return { rule: migration, sourceTemplate: tag };
      }
    }
  }
  return null;
}

/**
 * Execute a migration: transition a relationship from one template to another.
 *
 * Semantics:
 * - Replace the source tag with the target tag
 * - Preserve existing dimension values
 * - Add any new dimensions from the target template that don't exist yet
 * - Return a system.migration event for memory recording
 */
export function executeMigration(
  relationship: Relationship,
  sourceTemplate: string,
  targetTemplateName: string
): MigrationResult {
  const targetTemplate = resolveTemplate(targetTemplateName);
  if (!targetTemplate) {
    return { migrated: false };
  }

  // Replace tag: remove source, add target
  if (relationship.tags) {
    const idx = relationship.tags.indexOf(sourceTemplate);
    if (idx >= 0) {
      relationship.tags[idx] = targetTemplateName;
    } else {
      relationship.tags.push(targetTemplateName);
    }
    // Remove any duplicate of the source template
    relationship.tags = relationship.tags.filter(
      (t, i) => t !== sourceTemplate || i === relationship.tags!.indexOf(t)
    );
  } else {
    relationship.tags = [targetTemplateName];
  }

  // Supplement missing dimensions from target template
  const existingTypes = new Set(relationship.dimensions.map(d => d.type));
  for (const seed of targetTemplate.dimensions) {
    if (!existingTypes.has(seed.type)) {
      relationship.dimensions.push(seedToDimension(seed));
    }
  }

  // Create migration event
  const migrationEvent: RelationshipEvent = {
    id: `evt-migration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'system.migration',
    participants: [relationship.from, relationship.to],
    impact: {},
    description: `Relationship migrated from ${sourceTemplate} to ${targetTemplateName}`,
    source: 'migration-engine',
    metadata: {
      fromTemplate: sourceTemplate,
      toTemplate: targetTemplateName,
    },
  };

  return {
    migrated: true,
    fromTemplate: sourceTemplate,
    toTemplate: targetTemplateName,
    migrationEvent,
  };
}

/** Check if ALL conditions of a migration rule are met */
function allConditionsMet(relationship: Relationship, conditions: MigrationCondition[]): boolean {
  for (const condition of conditions) {
    const dim = relationship.dimensions.find(d => d.type === condition.dimension);
    if (!dim) return false;

    if (condition.operator === 'below' && dim.value >= condition.value) return false;
    if (condition.operator === 'above' && dim.value <= condition.value) return false;
  }
  return true;
}

/** Convert a DimensionSeed to a full Dimension */
function seedToDimension(seed: DimensionSeed): Dimension {
  return {
    type: seed.type,
    value: Math.max(-1, Math.min(1, seed.value)),
    confidence: seed.confidence ?? 0.5,
    volatility: seed.volatility ?? 0.3,
    source: 'declared',
  };
}
