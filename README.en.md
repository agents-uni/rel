<p align="center">
  <img src="assets/logo.png" alt="Agents Uni" width="120" />
</p>
<p align="center">
  <strong>@agents-uni/rel</strong><br/>
  <em>Multi-dimensional Relationship Engine for Agent Systems</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@agents-uni/rel"><img src="https://img.shields.io/npm/v/@agents-uni/rel.svg" alt="npm version" /></a>
  <a href="https://github.com/agents-uni/rel/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@agents-uni/rel.svg" alt="license" /></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/tests-163%20passed-brightgreen" alt="tests" />
</p>

---

> **Not just weighted edges. Living, multi-dimensional entities.**
>
> *[中文](README.md) | English*

## Why @agents-uni/rel?

Traditional agent relationships: `alice -> bob: ally (weight: 0.8)`

Real relationships are:

| Feature | Traditional | @agents-uni/rel |
|---------|-------------|----------------|
| Structure | Single weight | Multi-dimensional: trust / authority / rivalry / affinity — each independent |
| Change | Manual `setWeight()` | Event sourcing: all mutations through `RelationshipEvent` |
| Memory | None | Short-term events → long-term patterns + key moments + natural language summaries |
| Discovery | Only pre-declared | Emergence detection: auto-discover new relationships from interaction patterns |
| Analysis | BFS | Influence ranking, community detection, structural analysis |

Zero runtime dependencies. Works with any agent framework.

## Install

```bash
npm install @agents-uni/rel
```

## Quick Start

### 1. Build Graph + Templates

```typescript
import { RelationshipGraph } from '@agents-uni/rel';

const graph = new RelationshipGraph();

// Use built-in templates (16 types) — type auto-maps to dimensions + evolution rules
graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'rival' });
graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });
```

### 2. View Multi-dimensional State

```typescript
const rel = graph.getOutgoing('alice')[0]; // alice -> bob (ally)

for (const dim of rel.dimensions) {
  console.log(`${dim.type}: ${dim.value.toFixed(2)}  conf=${dim.confidence}  vol=${dim.volatility}`);
}
// trust:    0.60  conf=0.5  vol=0.4
// affinity: 0.50  conf=0.5  vol=0.3
// loyalty:  0.40  conf=0.5  vol=0.3
```

### 3. Event-driven Evolution

```typescript
import { EvolutionEngine } from '@agents-uni/rel';

const engine = new EvolutionEngine(graph);

// Event occurs -> engine matches template rules -> auto-adjusts dimensions
const results = engine.processEvent('alice', 'bob', 'alliance.supported');

console.log(results[0].dimensionChanges);
// {
//   trust:   { before: 0.60, after: 0.68 },
//   loyalty: { before: 0.40, after: 0.50 }
// }
```

### 4. Emergence: Auto-discover New Relationships

```typescript
import { EmergenceDetector } from '@agents-uni/rel';

const detector = new EmergenceDetector(graph);

// bob and dave have no declared relationship -- let interactions speak
for (let i = 0; i < 4; i++) {
  detector.processEvent({
    id: `evt-${i}`,
    timestamp: new Date().toISOString(),
    type: 'collaboration.success',
    participants: ['bob', 'dave'],
    impact: { trust: 0.05 },
  });
}
// 3rd event triggers frequent-collaboration rule
// Auto-creates bob <-> dave relationship (trust: 0.4, synergy: 0.3)

console.log(graph.getBetween('bob', 'dave').length); // 1
```

### 5. Memory Consolidation

```typescript
import { MemoryConsolidator } from '@agents-uni/rel';

const consolidator = new MemoryConsolidator();
const consolidated = consolidator.consolidateAll(graph);

// Short-term events -> long-term memory:
//   patterns:    ["frequent_collaboration (4 times)", "improving_trend"]
//   keyMoments:  [event with highest impact]
//   summary:     "alice -> bob: strong positive trust (0.68), ..."
```

---

## Core Concepts

### Multi-dimensional Relationships

```
Traditional:  alice -> bob: ally (0.8)

@agents-uni/rel:
alice -> bob:
  |-- trust:    ########.. 0.60   (confidence: 0.5, volatility: 0.4)
  |-- affinity: #####..... 0.50   (confidence: 0.5, volatility: 0.3)
  '-- loyalty:  ####...... 0.40   (confidence: 0.5, volatility: 0.3)
```

- **value** `[-1, +1]` -- Current strength. Trust can be negative (distrust)
- **confidence** `[0, 1]` -- Data sufficiency. Low for new relationships, increases with interactions
- **volatility** `[0, 1]` -- Rate of change. High = fluctuates easily, decays faster

### Event Sourcing

**All mutations through events**, fully auditable and replayable:

```typescript
// Low-level API: apply event to a specific relationship
graph.applyEvent(rel.id, {
  id: 'evt-1',
  timestamp: new Date().toISOString(),
  type: 'task.completed',
  participants: ['alice', 'bob'],
  impact: { trust: 0.1, affinity: 0.05 },
  description: 'Co-delivered Q1 report',
  source: 'openclaw:session-abc',
});

// Convenience API: auto-find by from/to (creates emerged relationship if none exists)
graph.applyEventBetween('alice', 'bob', {
  type: 'task.failed',
  impact: { trust: -0.1, reliability: -0.15 },
});
```

### Relationship Memory

```
RelationshipMemory
|-- shortTerm: RelationshipEvent[]       <-- Last 50 complete events
|-- longTerm:
|   |-- patterns: Pattern[]             <-- "frequent collaboration", "improving trend"
|   |-- keyMoments: RelationshipEvent[] <-- Top 5 highest-impact events
|   |-- summary: string                 <-- Natural language summary (can plug LLM)
|   '-- interactionCount: number
'-- valence: number                      <-- Emotional tone EMA (-1 ~ +1)
```

Custom summary generator (e.g., with LLM):

```typescript
const consolidator = new MemoryConsolidator({
  summaryGenerator: (rel) => callLLM(`Summarize: ${JSON.stringify(rel.memory)}`),
  minEvents: 10,       // At least 10 events before consolidation
  maxKeyMoments: 3,    // Keep 3 key moments
});
```

### Template System

16 built-in templates, each with preset dimensions + evolution rules:

| Template | Description | Core Dimensions | Example Rule |
|----------|-------------|-----------------|--------------|
| `superior` | Hierarchical authority | authority(0.8), trust(0.5), accountability(0.6) | `task.*` -> trust +0.05 |
| `subordinate` | Reports to | authority(-0.8), trust(0.5), dependence(0.6) | `task.completed` -> trust +0.05 |
| `peer` | Equal-level | trust(0.5), affinity(0.4), respect(0.5) | `collaboration.success` -> trust +0.06 |
| `competitive` | Competition | rivalry(0.5), respect(0.3), trust(0.2) | `competition.won` -> rivalry +0.08 |
| `ally` | Alliance | trust(0.6), affinity(0.5), loyalty(0.4) | `alliance.betrayed` -> trust -0.4 |
| `rival` | Persistent rival | rivalry(0.7), respect(0.4), trust(-0.2) | `competition.won` -> rivalry +0.05 |
| `mentor` | Knowledge transfer | authority(0.5), trust(0.6), knowledge_transfer(0.7) | `teaching.success` -> knowledge +0.08 |
| `advisor` / `advises` | Soft influence | influence(0.6), trust(0.5), respect(0.6) | `advice.followed` -> influence +0.08 |
| `reviewer` | Quality gate | authority(0.4), trust(0.5), rigor(0.6) | `review.approved` -> trust +0.05 |
| `delegate` | Work delegation | trust(0.5), authority(0.4), reliability(0.5) | `delegation.completed` -> trust +0.06 |
| `serves` | User-centric | loyalty(0.7), trust(0.5), devotion(0.5) | `service.excellent` -> trust +0.08 |
| `collaborates` | Active collaboration | trust(0.5), synergy(0.4), communication(0.5) | `collaboration.success` -> synergy +0.08 |
| `supervises` | Management | authority(0.7), trust(0.5), empowerment(0.4) | `task.completed_well` -> empowerment +0.06 |
| `competes` | Alias for competitive | rivalry(0.5), respect(0.3), trust(0.2) | Same as competitive |
| `audits` | Audit/oversight | authority(0.5), trust(0.4), transparency(0.6) | `audit.clean` -> trust +0.08 |

Custom templates:

```typescript
import { registerTemplate, registerTemplates, listTemplates } from '@agents-uni/rel';

registerTemplate({
  name: 'trade-partner',
  description: 'Frequent trading relationship',
  dimensions: [
    { type: 'trust', value: 0.5 },
    { type: 'trade_bond', value: 0.4, volatility: 0.3 },
  ],
  rules: [
    { on: 'trade.completed', adjust: { trust: 0.05, trade_bond: 0.08 } },
    { on: 'trade.disputed', adjust: { trust: -0.1, trade_bond: -0.05 } },
  ],
});

// Batch register
registerTemplates([template1, template2]);

// Query
console.log(listTemplates()); // ['superior', 'subordinate', ..., 'trade-partner']
```

### Emergence Detection

5 built-in emergence rules + custom:

| Rule | Trigger Condition | Created Relationship |
|------|-------------------|---------------------|
| `frequent-collaboration` | >=3 collaboration / task.completed events | trust(0.4) + synergy(0.3) |
| `repeated-competition` | >=3 competition / contest events | rivalry(0.4) + respect(0.2) |
| `escalating-conflict` | >=2 conflict / dispute / betray events | trust(-0.3) + rivalry(0.5) |
| `knowledge-sharing` | >=3 teaching / mentoring / knowledge events | knowledge_transfer(0.5) + trust(0.3) |
| `mutual-support` | >=3 alliance / support / help events | trust(0.5) + loyalty(0.4) + affinity(0.4) |

```typescript
const detector = new EmergenceDetector(graph, {
  autoCreate: true,       // Create on detection (default true)
  includeBuiltin: true,   // Include built-in rules (default true)
  customRules: [{
    name: 'trade-partners',
    description: 'Frequent traders',
    minEvents: 2,
    eventPatterns: ['trade.*'],
    detect: (events) => events.filter(e => e.type.includes('trade')).length >= 2,
    dimensions: [{ type: 'trade_bond', value: 0.5 }],
    tags: ['emerged', 'trade'],
  }],
});

// processEvent handles end-to-end:
//   Existing relationship -> applyEvent to graph
//   No relationship       -> buffer -> pattern match -> emerge
const emergences = detector.processEvent(event);
```

### Time Decay

Inactive relationships decay toward neutral, proportional to volatility:

```typescript
// Apply decay to all relationships not updated in 1+ days
const decayedCount = graph.applyDecay(0.01); // decayRate
// value > 0 shrinks toward 0, value < 0 grows toward 0
// confidence decays in parallel (data grows stale)
```

### Social Network Analysis

```typescript
import {
  computeInfluence,
  detectClusters,
  analyzeStructure,
  queryRelationships,
} from '@agents-uni/rel';

// === Influence Ranking ===
const scores = computeInfluence(graph, 'trust');
// [
//   { agentId: 'alice', score: 0.87, components: {
//       degreeCentrality: 0.8,
//       weightedInfluence: 0.9,
//       bridgingBonus: 0.5
//   }},
//   ...
// ]

// === Community Detection ===
const clusters = detectClusters(graph, 'trust', 0.3);
// { clusters: [{ id: 'cluster-0', members: ['alice', 'bob'], cohesion: 0.65 }] }

// === Structural Analysis ===
const analysis = analyzeStructure(graph);
// {
//   agentCount: 5,  relationshipCount: 8,  density: 0.4,
//   clusterCount: 2,  averageDegree: 3.2,
//   hub: { agentId: 'alice', degree: 5 },
//   mostTrusted: { agentId: 'bob', totalTrust: 1.8 },
//   mostRival: { agentId: 'charlie', totalRivalry: 1.2 },
//   graphValence: 0.35,
// }

// === Complex Queries ===
const results = queryRelationships(graph, {
  from: 'alice',                                // Source filter
  minDimension: { type: 'trust', value: 0.5 },  // Dimension threshold
  minValence: 0,                                // Minimum emotional tone
  origin: 'declared',                           // Origin type
  tag: 'ally',                                  // Tag match
});
// Returns { relationship, strength }[], sorted by strength descending
```

---

## Persistence

```typescript
// Export full graph state
const snapshot = graph.toJSON();
// { relationships: [{ id, from, to, dimensions, memory, origin, ... }, ...] }

import fs from 'node:fs';
fs.writeFileSync('graph.json', JSON.stringify(snapshot));

// Restore
const data = JSON.parse(fs.readFileSync('graph.json', 'utf-8'));
const restored = RelationshipGraph.fromJSON(data, { maxShortTerm: 100 });

// Simplified adjacency list (for visualization / legacy system compat)
const adj = graph.toAdjacencyList();
// { 'alice': [{ to: 'bob', dimensions: { trust: 0.68 }, valence: 0.35 }] }
```

---

## OpenClaw Integration

```typescript
import { OpenClawMemoryAdapter, generateSoulRelationshipSection } from '@agents-uni/rel';

// Extract events from OpenClaw session files
const adapter = new OpenClawMemoryAdapter({
  openclawDir: '~/.openclaw',          // Default path
  inferEvent: (content) => ({ ... }),   // Custom event inference logic
});
const events = await adapter.fetchEvents('2026-01-01T00:00:00Z');

// Write relationship context back to agent workspace
await adapter.writeContext('zhenhuan', context);
// -> ~/.openclaw/workspace-zhenhuan/RELATIONSHIPS.md

// Generate SOUL.md relationship section (zh / en)
const section = generateSoulRelationshipSection(context, 'en');
```

## Integration with agents-uni-core

`@agents-uni/core` has a built-in rel bridge:

```typescript
import {
  createRelEngine,
  createRelGraph,
  generateEnhancedRelationshipSection,
} from '@agents-uni/core';

// Create full engine from UniverseConfig
const { graph, evolution, consolidator, emergence } = createRelEngine(universeConfig);

// Or just create the graph
const graph = createRelGraph(universeConfig.relationships);

// Use enhanced relationship section in SOUL.md generation
const section = generateEnhancedRelationshipSection(agent, universe, graph, 'en');
```

## Backward Compatibility

100% compatible with agents-uni-core YAML relationship definitions:

```typescript
import { fromLegacy, fromLegacyArray, fromYamlObject } from '@agents-uni/rel';

// Single
const seed = fromLegacy({ from: 'a', to: 'b', type: 'ally', weight: 0.9 });

// Batch
const seeds = fromLegacyArray([
  { from: 'emperor', to: 'empress', type: 'superior', weight: 0.9 },
  { from: 'zhenhuan', to: 'emperor', type: 'serves' },
  { from: 'zhenhuan', to: 'huafei', type: 'rival', weight: 0.8 },
]);
const graph = new RelationshipGraph(seeds);

// From YAML object
const seed2 = fromYamlObject({ from: 'a', to: 'b', type: 'peer', weight: 0.5 });
```

---

## API Reference

### Classes

| Class | Constructor | Description |
|-------|------------|-------------|
| `RelationshipGraph` | `(seeds?, options?)` | Multi-dimensional directed relationship graph |
| `EvolutionEngine` | `(graph, options?)` | Event → template rules → dimension adjustments (supports traits, migration) |
| `MemoryConsolidator` | `(options?)` | Short-term → long-term patterns + summaries |
| `EmergenceDetector` | `(graph, options?)` | Interaction patterns → new relationships |
| `OpenClawMemoryAdapter` | `(options?)` | OpenClaw session → Event |

### RelationshipGraph Methods

| Method | Description |
|--------|-------------|
| `addFromSeed(seed)` | Create relationship from seed, returns `Relationship` |
| `get(id)` | Query by ID |
| `getOutgoing(agentId)` | Outgoing edges |
| `getIncoming(agentId)` | Incoming edges |
| `getAll(agentId)` | All edges (both directions) |
| `getBetween(from, to)` | All edges between two agents (bidirectional) |
| `getByDimension(agentId, dimType, minValue?)` | Filter by dimension type and threshold |
| `getDimensionValue(from, to, dimType)` | Get single dimension value |
| `getStrongestConnections(agentId, dimType?, limit?)` | Top N strongest connections |
| `getAllAgentIds()` | All node IDs |
| `getAllRelationships()` | All edges |
| `size` | Total edge count (getter) |
| `applyEvent(relId, event)` | Apply event to specific relationship |
| `applyEventBetween(from, to, partialEvent)` | Apply by endpoints (creates if none exists) |
| `findPath(from, to, dimType?)` | BFS shortest path |
| `applyDecay(rate?)` | Time decay |
| `toJSON()` | Export full state |
| `fromJSON(data, options?)` | Static method, restore from JSON |
| `toAdjacencyList()` | Adjacency list export |

### EvolutionEngine Methods

| Method | Description |
|--------|-------------|
| `processEvent(from, to, eventType, options?)` | Process pairwise event, returns `EvolutionResult[]` |
| `processGroupEvent(agentIds, eventType, options?)` | Multi-agent event (pairwise) |
| `addGlobalRule(rule)` | Add global evolution rule |
| `setTraitRegistry(traits)` | Update agent trait registry |
| `getTraitRegistry()` | Get current trait registry |

### Utility Functions

| Function | Description |
|----------|-------------|
| `registerTemplate(t)` | Register custom template |
| `registerTemplates(ts)` | Batch register |
| `resolveTemplate(name)` | Find template (custom takes priority) |
| `listTemplates()` | List all template names |
| `getBuiltinTemplates()` | Get built-in templates |
| `fromLegacy(def)` | Convert legacy format (single) |
| `fromLegacyArray(defs)` | Convert legacy format (batch) |
| `fromYamlObject(obj)` | Convert YAML object |
| `computeInfluence(graph, dimType?)` | Influence ranking |
| `detectClusters(graph, dimType?, minValue?)` | Community detection |
| `analyzeStructure(graph)` | Structural analysis |
| `queryRelationships(graph, filter)` | Complex queries |
| `formatRelationshipContext(ctx)` | Markdown relationship report |
| `generateSoulRelationshipSection(ctx, lang?)` | SOUL.md relationship section |
| `generateReport(graph)` | Generate full relationship network report |
| `applyTraitModifiers(adjust, from, to, event, traits)` | Modify dimension deltas based on agent traits |
| `checkMigration(relationship)` | Check if relationship should migrate to another template |
| `executeMigration(rel, from, to)` | Execute relationship template migration |
| `resolveImpactFromTemplates(event, rel)` | Resolve event impact from template rules |

### Visualization Data

Export the relationship graph into a frontend-friendly format (nodes + edges + clusters), ready for use with D3, Cytoscape, or other graph visualization libraries:

```typescript
import { RelationshipGraph } from '@agents-uni/rel';

const graph = new RelationshipGraph([...]);
const vizData = graph.toVisualizationData({
  agentMetadata: { alice: { name: 'Alice', role: 'Engineer' } }
});
// vizData: { nodes, edges, clusters, generatedAt }
```

- **nodes** -- Agent ID, labels, metadata (e.g., name, role), degree statistics
- **edges** -- Source/target, per-dimension weights, emotional valence, origin type
- **clusters** -- Community detection results with member lists and cohesion scores
- **generatedAt** -- Timestamp of data generation

### Report Generation

Generate a comprehensive relationship network analysis report in one call, including structural summary, influence ranking, community partitions, and relationship hotspots:

```typescript
import { generateReport } from '@agents-uni/rel';

const report = generateReport(graph);
// report: { summary, structure, influenceRanking, clusters, hotspots, generatedAt }
```

- **summary** -- Natural language network overview (agent count, relationship count, overall valence)
- **structure** -- Structural analysis results (density, average degree, hub nodes, etc.)
- **influenceRanking** -- Agents sorted by influence score
- **clusters** -- Community partitions with cohesion scores per cluster
- **hotspots** -- High-activity / high-volatility key relationships
- **generatedAt** -- Report generation timestamp

---

## Relationship Migration

When a relationship's dimensions cross certain thresholds, it can automatically migrate to a different template type. For example, an ally becomes a rival when trust drops below -0.2:

```typescript
import { EvolutionEngine } from '@agents-uni/rel';

const engine = new EvolutionEngine(graph, {
  onMigration: (result, relId) => {
    console.log(`${relId}: ${result.fromTemplate} → ${result.toTemplate}`);
  },
});

// Repeated betrayal events cause trust to plummet
engine.processEvent('alice', 'bob', 'alliance.betrayed');
// result.migration = { migrated: true, fromTemplate: 'ally', toTemplate: 'rival' }
```

Built-in migration rules:

| From | To | Trigger |
|------|----|---------|
| ally | rival | trust < -0.2 |
| ally | peer | loyalty < 0.1 and trust > 0.1 |
| peer | ally | trust > 0.7 and affinity > 0.6 |
| peer | competitive | trust < 0.0 and respect < 0.2 |
| rival | ally | trust > 0.5 and rivalry < 0.2 |
| competitive | rival | rivalry > 0.8 and trust < -0.1 |
| competitive | peer | rivalry < 0.15 and respect > 0.5 |

Custom templates can also define `migrations`.

## Trait-Aware Evolution

Agent personality traits influence how much relationship dimensions change:

```typescript
const engine = new EvolutionEngine(graph, {
  traits: {
    alice: { empathy: 0.9, analytical: 0.7 },
    bob: { ambition: 0.8, deception: 0.6 },
  },
});

// High-empathy alice loses less trust in conflict events
engine.processEvent('alice', 'bob', 'conflict.escalated');
```

Built-in trait rules:
- **empathy ≥ 0.7** (source): negative dimension deltas × 0.6 (more forgiving)
- **ambition ≥ 0.8** (target): rivalry/competition deltas × 1.4 (more aggressive)
- **deception ≥ 0.7** (source): trust deltas × 0.5 (harder to gain trust)

## Relationship Generation

Auto-generate relationship seeds from natural language descriptions:

```typescript
import { RelationshipGenerator, ScenarioSuggester } from '@agents-uni/rel';

// Generate relationships
const generator = new RelationshipGenerator();
const result = await generator.generate('palace drama with 7 concubines', agents, {
  type: 'competitive',
  language: 'en',
});
// result.seeds: [{ from, to, type, dimensions }]
// result.reasoning: ['huafei has highest rank, forms superior relationship...']

// Scenario suggestions
const suggester = new ScenarioSuggester(graph);
const events = suggester.suggest(5);
// [{ eventType: 'conflict.escalated', from: 'zhenhuan', to: 'huafei',
//    reason: 'High rivalry tension', dramaPotential: 0.85 }]
```

---

## Architecture

```
                          +-----------------+
                          |  universe.yaml  |
                          +--------+--------+
                                   |
                            fromLegacyArray()
                                   v
+----------+    addFromSeed()    +------------------+
| Templates | -----------------> | RelationshipGraph |
| (16 types)|   resolve dims     | (multi-dim edges) |
+----------+                     +----+----+--------+
                                      |    ^
                         applyEvent() |    | rules match
                                      v    |
                                 +----+----+-----+
             RelationshipEvent   | EvolutionEngine |
                  |              +----------------+
                  v
            +-----+------+
            |   Memory    |
            | shortTerm[] |----> MemoryConsolidator ----> longTerm
            +-----+------+        patterns, keyMoments, summary
                  |
                  v
          +-------+--------+
          | EmergenceDetector |  buffer events for unknown pairs
          | (5 builtin rules) |-- detect() --> new Relationship
          +------------------+

                  |
                  v
          +-------+--------+
          | Query & Analysis |  computeInfluence, detectClusters
          | (SNA algorithms) |  analyzeStructure, queryRelationships
          +------------------+

                  |
                  v
          +-------+---------+
          | OpenClaw Adapter  |  fetchEvents() from sessions
          | SOUL.md Generator |  writeContext() to workspaces
          +-------------------+
```

## Contributing Templates

We welcome community contributions of new relationship templates! Each template is a standalone file defining a relationship's dimension presets and evolution rules.

### Template File Structure

```
src/templates/builtin/
├── index.ts          ← Barrel export
├── ally.ts           ← Alliance template
├── rival.ts          ← Rival template
├── mentor.ts         ← Mentor template
├── ...               ← Other built-in templates
└── your-template.ts  ← Your new template
```

### Steps

1. **Fork and clone** this repository
2. **Create template file** `src/templates/builtin/your-template.ts`:

```typescript
import type { RelationshipTemplate } from '../../schema/types.js';

export const yourTemplate: RelationshipTemplate = {
  name: 'your-template',
  description: 'Brief description of this relationship',
  dimensions: [
    // Define 2-4 dimensions, value range [-1, +1]
    { type: 'trust', value: 0.5 },
    { type: 'custom_dim', value: 0.3, volatility: 0.4 },
  ],
  rules: [
    // Define event -> dimension adjustment rules, supports glob (e.g. task.*)
    { on: 'event.type', adjust: { trust: 0.05 }, description: 'Optional description' },
  ],
  tags: ['optional-tag'],  // Optional
};
```

3. **Export from `builtin/index.ts`**:

```typescript
export { yourTemplate } from './your-template.js';
```

4. **Run tests** `npm test` — ensure all 163+ tests pass
5. **Submit PR**, title format: `feat(template): add your-template`

### Template Design Guidelines

- **Dimensions**: Choose 2-4 dimensions that best describe the relationship. Prefer reusing existing dimension types (trust, authority, rivalry, affinity, respect, loyalty)
- **Rules**: Each rule describes how an event affects dimensions. Adjustment values are typically in the `±0.03 ~ ±0.15` range
- **Naming**: Use lowercase kebab-case (e.g., `trade-partner`)
- **Testing**: Built-in templates are automatically tested via `templates.test.ts`, ensuring each has name, dimensions, and rules

---

## Design Philosophy

1. **Relationships as first-class citizens** -- Not graph appendages, but entities with their own state, memory, and history
2. **All changes through events** -- Fully auditable, replayable, persistable
3. **Template-driven + emergent** -- Supports both predefined patterns and naturally occurring ones
4. **Universal, not specialized** -- Not bound to OpenClaw / agents-uni / any specific framework

---

## Related Projects

- [**@agents-uni/core**](https://github.com/agents-uni/core) -- Agent organization protocol layer
- [**@agents-uni/unis**](https://github.com/agents-uni/unis) -- Curated universe templates (5 ready-to-play scenarios)
- [**@agents-uni/zhenhuan**](https://github.com/agents-uni/zhenhuan) -- Palace drama agent competition
- [**OpenClaw**](https://github.com/anthropics/openclaw) -- Agent runtime

## License

MIT
