/**
 * Legacy YAML adapter — converts agents-uni-core relationship definitions
 * to the new @agents-uni/rel seed format.
 *
 * This ensures backward compatibility with existing universe.yaml files.
 */

import type { RelationshipSeed, DimensionSeed } from '../schema/types.js';

// ═══════════════════════════════════════════════════════
//  Legacy types (from agents-uni-core)
// ═══════════════════════════════════════════════════════

/**
 * Legacy relationship definition as found in agents-uni-core universe.yaml.
 *
 * Example:
 * ```yaml
 * relationships:
 *   - from: emperor
 *     to: empress
 *     type: superior
 *     weight: 0.9
 * ```
 */
export interface LegacyRelationshipDefinition {
  from: string;
  to: string;
  type?: string;
  weight?: number;
  bidirectional?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
//  Legacy type → template name mapping
// ═══════════════════════════════════════════════════════

const LEGACY_TYPE_MAP: Record<string, string> = {
  superior: 'superior',
  subordinate: 'subordinate',
  peer: 'peer',
  competitive: 'competitive',
  ally: 'ally',
  rival: 'rival',
  mentor: 'mentor',
  advisor: 'advisor',
  reviewer: 'reviewer',
  delegate: 'delegate',
  serves: 'serves',
  collaborates: 'collaborates',
  supervises: 'supervises',
  competes: 'competes',
  audits: 'audits',
  advises: 'advises',
};

/**
 * Weight-based fallback dimensions when no type is specified.
 * Maps a scalar weight to multi-dimensional representation.
 */
function weightToDimensions(weight: number): DimensionSeed[] {
  const absWeight = Math.abs(weight);
  const sign = weight >= 0 ? 1 : -1;

  return [
    { type: 'affinity', value: sign * absWeight * 0.8, confidence: 0.5 },
    { type: 'trust', value: sign * absWeight * 0.6, confidence: 0.4 },
  ];
}

// ═══════════════════════════════════════════════════════
//  Conversion functions
// ═══════════════════════════════════════════════════════

/**
 * Convert a single legacy relationship definition to a RelationshipSeed.
 */
export function fromLegacy(def: LegacyRelationshipDefinition): RelationshipSeed {
  const seed: RelationshipSeed = {
    from: def.from,
    to: def.to,
  };

  // Map legacy type to template name
  if (def.type) {
    const templateName = LEGACY_TYPE_MAP[def.type];
    if (templateName) {
      seed.type = templateName;
    } else {
      // Unknown type — pass through, template registry will handle it
      seed.type = def.type;
    }
  }

  // If weight is provided but no type, generate dimensions from weight
  if (def.weight !== undefined && !def.type) {
    seed.dimensions = weightToDimensions(def.weight);
  }

  // Preserve weight for template dimension scaling
  if (def.weight !== undefined) {
    seed.weight = def.weight;
  }

  if (def.tags) {
    seed.tags = [...def.tags];
  }

  if (def.metadata) {
    seed.metadata = { ...def.metadata };
  }

  return seed;
}

/**
 * Convert an array of legacy definitions to RelationshipSeeds.
 * Handles bidirectional relationships by creating two seeds.
 */
export function fromLegacyArray(defs: LegacyRelationshipDefinition[]): RelationshipSeed[] {
  const seeds: RelationshipSeed[] = [];

  for (const def of defs) {
    seeds.push(fromLegacy(def));

    // Create reverse relationship for bidirectional
    if (def.bidirectional) {
      seeds.push(fromLegacy({
        ...def,
        from: def.to,
        to: def.from,
        bidirectional: false, // avoid infinite recursion
      }));
    }
  }

  return seeds;
}

/**
 * Parse a raw YAML-like object (already parsed from YAML) into seeds.
 * Accepts the `relationships` array from a universe.yaml structure.
 */
export function fromYamlObject(yamlData: {
  relationships?: LegacyRelationshipDefinition[];
}): RelationshipSeed[] {
  if (!yamlData.relationships || !Array.isArray(yamlData.relationships)) {
    return [];
  }

  return fromLegacyArray(yamlData.relationships);
}
