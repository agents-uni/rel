/**
 * @agents-uni/rel — Multi-dimensional relationship engine for agent systems.
 *
 * Event-sourced, memory-backed, evolvable relationships
 * that go beyond simple weighted edges.
 *
 * @example
 * ```typescript
 * import {
 *   RelationshipGraph,
 *   EvolutionEngine,
 *   MemoryConsolidator,
 *   EmergenceDetector,
 * } from '@agents-uni/rel';
 *
 * const graph = new RelationshipGraph();
 * graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
 *
 * const engine = new EvolutionEngine(graph);
 * engine.processEvent('alice', 'bob', 'task.completed');
 *
 * const detector = new EmergenceDetector(graph);
 * detector.processEvent({
 *   id: 'evt-1',
 *   timestamp: new Date().toISOString(),
 *   type: 'collaboration.success',
 *   participants: ['alice', 'charlie'],
 *   impact: { trust: 0.1 },
 * });
 *
 * const consolidator = new MemoryConsolidator();
 * consolidator.consolidateAll(graph);
 * ```
 *
 * @packageDocumentation
 */

// ── Schema (types) ──────────────────────────────────
export type {
  Dimension,
  DimensionSeed,
  DimensionSource,
  Relationship,
  RelationshipOrigin,
  RelationshipMemory,
  LongTermMemory,
  RelationshipEvent,
  Pattern,
  RelationshipSeed,
  RelationshipTemplate,
  EvolutionRule,
  MemoryAdapter,
  RelationshipContext,
  RelationshipQueryResult,
  PathResult,
  ClusterResult,
  VisualizationNode,
  VisualizationEdge,
  VisualizationCluster,
  VisualizationData,
  VisualizationOptions,
} from './schema/index.js';

// ── Graph ───────────────────────────────────────────
export { RelationshipGraph } from './graph/index.js';
export type { GraphOptions } from './graph/index.js';

// ── Templates ───────────────────────────────────────
export {
  registerTemplate,
  registerTemplates,
  resolveTemplate,
  listTemplates,
  getBuiltinTemplates,
} from './templates/index.js';

// ── Evolution ───────────────────────────────────────
export { EvolutionEngine } from './evolution/index.js';
export type { EvolutionResult } from './evolution/index.js';

// ── Memory ──────────────────────────────────────────
export { MemoryConsolidator } from './memory/index.js';
export type { ConsolidationResult, ConsolidationOptions } from './memory/index.js';

// ── Emergence ───────────────────────────────────────
export { EmergenceDetector } from './emergence/index.js';
export type { EmergenceRule, EmergenceResult, EmergenceDetectorOptions } from './emergence/index.js';

// ── Query & Analysis ────────────────────────────────
export {
  computeInfluence,
  detectClusters,
  analyzeStructure,
  queryRelationships,
  generateReport,
} from './query/index.js';
export type { InfluenceScore, StructuralAnalysis, QueryFilter, RelationshipReport, RelationshipHotspot } from './query/index.js';

// ── Adapters ────────────────────────────────────────
export {
  fromLegacy,
  fromLegacyArray,
  fromYamlObject,
  OpenClawMemoryAdapter,
  formatRelationshipContext,
  generateSoulRelationshipSection,
} from './adapters/index.js';
export type { LegacyRelationshipDefinition, OpenClawAdapterOptions } from './adapters/index.js';
