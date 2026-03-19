/**
 * Core type system for @agents-uni/rel.
 *
 * Design principle: relationships are multi-dimensional, event-sourced,
 * memory-backed entities — not just weighted edges.
 */

// ═══════════════════════════════════════════════════════
//  Dimension — a single axis of a relationship
// ═══════════════════════════════════════════════════════

/**
 * A single measurable aspect of a relationship.
 *
 * Unlike a flat "weight", dimensions allow a relationship to be
 * simultaneously trusting AND competitive, authoritative BUT declining.
 */
export interface Dimension {
  /** Dimension identifier, e.g. "trust", "authority", "affinity", "rivalry" */
  type: string;
  /** Current value: -1.0 (negative) to +1.0 (positive) */
  value: number;
  /** How confident we are in this value: 0.0 (no data) to 1.0 (highly certain) */
  confidence: number;
  /** How quickly this dimension changes: 0.0 (stable) to 1.0 (volatile) */
  volatility: number;
  /** Where this value came from */
  source: DimensionSource;
}

export type DimensionSource = 'declared' | 'inferred' | 'evolved';

/** Shorthand for declaring a dimension with defaults */
export interface DimensionSeed {
  type: string;
  value: number;
  confidence?: number;
  volatility?: number;
}

// ═══════════════════════════════════════════════════════
//  Relationship — a living, multi-dimensional entity
// ═══════════════════════════════════════════════════════

/**
 * A relationship between two agents.
 *
 * This is NOT a simple edge — it's a first-class entity with
 * multi-dimensional state and its own memory.
 */
export interface Relationship {
  /** Unique relationship ID */
  id: string;
  /** Source agent identifier */
  from: string;
  /** Target agent identifier */
  to: string;
  /** Multi-dimensional state */
  dimensions: Dimension[];
  /** Relationship memory */
  memory: RelationshipMemory;
  /** How this relationship was created */
  origin: RelationshipOrigin;
  /** Metadata */
  createdAt: string;
  updatedAt: string;
  /** Optional tags for filtering / grouping */
  tags?: string[];
}

export type RelationshipOrigin = 'declared' | 'inferred' | 'emerged';

// ═══════════════════════════════════════════════════════
//  Memory — the history and compressed knowledge
// ═══════════════════════════════════════════════════════

/**
 * Relationship memory — this is where OpenClaw / session data maps to.
 *
 * Modeled after human relational memory:
 * - shortTerm: recent interactions (full detail)
 * - longTerm: compressed patterns and key moments
 * - valence: the intuitive "feeling" of the relationship
 */
export interface RelationshipMemory {
  /** Recent events, kept in full (windowed to maxShortTerm) */
  shortTerm: RelationshipEvent[];
  /** Compressed long-term knowledge */
  longTerm: LongTermMemory;
  /** Overall emotional tone: -1 (hostile) to +1 (trusted ally) */
  valence: number;
}

export interface LongTermMemory {
  /** Natural-language summary of the relationship history */
  summary: string;
  /** Detected interaction patterns */
  patterns: Pattern[];
  /** The most impactful events (curated subset) */
  keyMoments: RelationshipEvent[];
  /** Total interaction count (including consolidated) */
  interactionCount: number;
}

// ═══════════════════════════════════════════════════════
//  Event — the atomic unit of relationship change
// ═══════════════════════════════════════════════════════

/**
 * A single event that affects a relationship.
 *
 * All relationship changes come through events — this is what makes
 * the system event-sourced and auditable.
 */
export interface RelationshipEvent {
  /** Unique event ID */
  id: string;
  /** When it happened */
  timestamp: string;
  /** Event type, e.g. "task.collaborated", "competition.won", "conflict.resolved" */
  type: string;
  /** Agents involved */
  participants: string[];
  /** Dimension impacts: dimension type → delta value */
  impact: Record<string, number>;
  /** Human-readable description */
  description?: string;
  /** Origin system identifier, e.g. "openclaw:session-abc", "manual" */
  source?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
//  Pattern — extracted from event history
// ═══════════════════════════════════════════════════════

export interface Pattern {
  /** Pattern identifier, e.g. "frequent_collaboration", "escalating_rivalry" */
  type: string;
  /** How often this pattern occurs (0.0-1.0) */
  frequency: number;
  /** When it was last observed */
  lastSeen: string;
  /** Human-readable description */
  description: string;
}

// ═══════════════════════════════════════════════════════
//  Seed — for declaring initial relationships (YAML compat)
// ═══════════════════════════════════════════════════════

/**
 * A seed defines the starting state of a relationship.
 * This is what you write in YAML — the rel engine brings it to life.
 */
export interface RelationshipSeed {
  from: string;
  to: string;
  /** Pre-built relationship type (maps to dimension preset) */
  type?: string;
  /** Or explicit dimensions */
  dimensions?: DimensionSeed[];
  /** Initial weight (legacy compat — maps to primary dimension value) */
  weight?: number;
  /** Tags */
  tags?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
//  Template — reusable relationship patterns
// ═══════════════════════════════════════════════════════

/**
 * A relationship template defines:
 * 1. Default dimensions for a relationship type
 * 2. Evolution rules triggered by events
 */
export interface RelationshipTemplate {
  /** Template name, e.g. "mentor-mentee", "corporate-hierarchy" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Default dimensions when this template is applied */
  dimensions: DimensionSeed[];
  /** Evolution rules: event type → dimension adjustments */
  rules: EvolutionRule[];
  /** Tags automatically applied */
  tags?: string[];
  /** Optional migration rules — conditions under which this relationship type auto-transitions */
  migrations?: MigrationRule[];
}

export interface EvolutionRule {
  /** Event type to match (supports glob: "task.*") */
  on: string;
  /** Dimension adjustments to apply */
  adjust: Record<string, number>;
  /** Optional condition (simple expression) */
  condition?: string;
  /** Optional description */
  description?: string;
}

// ═══════════════════════════════════════════════════════
//  Migration — automatic relationship type transitions
// ═══════════════════════════════════════════════════════

/** A rule that defines when a relationship should migrate to a different template */
export interface MigrationRule {
  /** Target template name to migrate to */
  targetTemplate: string;
  /** ALL conditions must be satisfied for migration to trigger */
  when: MigrationCondition[];
}

/** A single condition for a migration rule */
export interface MigrationCondition {
  /** Dimension to check */
  dimension: string;
  /** Comparison operator */
  operator: 'below' | 'above';
  /** Threshold value */
  value: number;
}

// ═══════════════════════════════════════════════════════
//  Trait-aware evolution
// ═══════════════════════════════════════════════════════

/** Registry mapping agent IDs to their trait values */
export type TraitRegistry = Record<string, Record<string, number>>;

/** A rule that modifies dimension deltas based on agent traits */
export interface TraitModifierRule {
  /** Which trait to check */
  trait: string;
  /** Minimum trait value for this rule to apply */
  threshold: number;
  /** Whether to check the source agent, target agent, or both */
  appliesTo: 'source' | 'target' | 'both';
  /** Which dimension types this modifier affects (empty = all) */
  affectedDimensions?: string[];
  /** Multiplier applied to the delta (e.g., 0.6 suppresses, 1.4 amplifies) */
  multiplier: number;
  /** Optional description */
  description?: string;
}

// ═══════════════════════════════════════════════════════
//  Adapter interfaces — for external system integration
// ═══════════════════════════════════════════════════════

/**
 * Memory adapter — pluggable backend for event storage and retrieval.
 * Implement this to connect @agents-uni/rel to any external system.
 */
export interface MemoryAdapter {
  /** Fetch interaction events from external system since a given timestamp */
  fetchEvents(since: string): Promise<RelationshipEvent[]>;

  /** Write relationship context back to external system (e.g., update SOUL.md) */
  writeContext(agentId: string, context: RelationshipContext): Promise<void>;
}

/**
 * Relationship context written to an agent (e.g., into SOUL.md).
 */
export interface RelationshipContext {
  agentId: string;
  relationships: Array<{
    otherAgentId: string;
    otherAgentName?: string;
    summary: string;
    dimensions: Array<{ type: string; value: number }>;
    valence: number;
    recentInteractions: number;
  }>;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════
//  Query result types
// ═══════════════════════════════════════════════════════

export interface RelationshipQueryResult {
  relationship: Relationship;
  /** Computed "strength" for ranking/sorting */
  strength: number;
}

export interface PathResult {
  path: string[];
  /** Total cost (inverse of trust/affinity along path) */
  cost: number;
  relationships: Relationship[];
}

export interface ClusterResult {
  clusters: Array<{
    id: string;
    members: string[];
    cohesion: number;
  }>;
}
