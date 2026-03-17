<p align="center">
  <strong>@agents-uni/rel</strong><br/>
  <em>Multi-dimensional Relationship Engine for Agent Systems</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@agents-uni/rel"><img src="https://img.shields.io/npm/v/@agents-uni/rel.svg" alt="npm version" /></a>
  <a href="https://github.com/agents-uni/rel/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@agents-uni/rel.svg" alt="license" /></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/tests-138%20passed-brightgreen" alt="tests" />
</p>

---

> **Not just weighted edges. Living, multi-dimensional entities.**
>
> *[English](#english) | 中文*

## 为什么需要 @agents-uni/rel？

传统 agent 关系：`alice -> bob: ally (weight: 0.8)`

现实中的关系是：

| 特征 | 传统 | @agents-uni/rel |
|------|------|----------------|
| 结构 | 单一权重 | 多维：trust / authority / rivalry / affinity 各自独立 |
| 变化 | 手动 `setWeight()` | 事件溯源：所有变更通过 `RelationshipEvent` |
| 记忆 | 无 | 短期事件 -> 长期模式 + 关键时刻 + 自然语言摘要 |
| 发现 | 只有预声明 | 涌现检测：从交互模式自动发现新关系 |
| 分析 | BFS | 影响力排名、社区检测、结构分析 |

零运行时依赖。适用于任何 agent 框架。

## 安装

```bash
npm install @agents-uni/rel
```

## 快速开始

### 1. 建图 + 模板

```typescript
import { RelationshipGraph } from '@agents-uni/rel';

const graph = new RelationshipGraph();

// 用内置模板（16 种）声明关系 — type 自动映射维度 + 演化规则
graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'rival' });
graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });
```

### 2. 查看多维状态

```typescript
const rel = graph.getOutgoing('alice')[0]; // alice -> bob (ally)

for (const dim of rel.dimensions) {
  console.log(`${dim.type}: ${dim.value.toFixed(2)}  conf=${dim.confidence}  vol=${dim.volatility}`);
}
// trust:    0.60  conf=0.5  vol=0.4
// affinity: 0.50  conf=0.5  vol=0.3
// loyalty:  0.40  conf=0.5  vol=0.3
```

### 3. 事件驱动进化

```typescript
import { EvolutionEngine } from '@agents-uni/rel';

const engine = new EvolutionEngine(graph);

// 发生事件 -> 引擎匹配模板规则 -> 自动调整维度
const results = engine.processEvent('alice', 'bob', 'alliance.supported');

console.log(results[0].dimensionChanges);
// {
//   trust:   { before: 0.60, after: 0.68 },
//   loyalty: { before: 0.40, after: 0.50 }
// }
console.log(results[0].appliedRules);
// ['alliance.supported -> {"trust":0.08,"loyalty":0.1}']
```

### 4. 涌现：自动发现新关系

```typescript
import { EmergenceDetector } from '@agents-uni/rel';

const detector = new EmergenceDetector(graph);

// bob 和 dave 之间没有声明关系 -- 让交互来说话
for (let i = 0; i < 4; i++) {
  detector.processEvent({
    id: `evt-${i}`,
    timestamp: new Date().toISOString(),
    type: 'collaboration.success',
    participants: ['bob', 'dave'],
    impact: { trust: 0.05 },
  });
}
// 第 3 次触发 frequent-collaboration 规则
// 自动在图中创建 bob <-> dave 关系 (trust: 0.4, synergy: 0.3)

console.log(graph.getBetween('bob', 'dave').length); // 1
```

### 5. 记忆固化

```typescript
import { MemoryConsolidator } from '@agents-uni/rel';

const consolidator = new MemoryConsolidator();
const consolidated = consolidator.consolidateAll(graph);

// 短期事件 -> 长期记忆：
//   patterns:    ["frequent_collaboration (4 times)", "improving_trend"]
//   keyMoments:  [event with highest impact]
//   summary:     "alice -> bob: strong positive trust (0.68), ..."
```

---

## 核心概念

### 多维关系

```
传统:  alice -> bob: ally (0.8)

@agents-uni/rel:
alice -> bob:
  |-- trust:    ########.. 0.60   (confidence: 0.5, volatility: 0.4)
  |-- affinity: #####..... 0.50   (confidence: 0.5, volatility: 0.3)
  '-- loyalty:  ####...... 0.40   (confidence: 0.5, volatility: 0.3)
```

- **value** `[-1, +1]` -- 当前强度。信任可以为负（不信任）
- **confidence** `[0, 1]` -- 数据充分度。新关系低，交互多则高
- **volatility** `[0, 1]` -- 变化速率。高 = 容易波动，衰减快

### 事件溯源

**所有变更通过事件**，完整可审计、可重放：

```typescript
// 低层 API: 直接对某条关系施加事件
graph.applyEvent(rel.id, {
  id: 'evt-1',
  timestamp: new Date().toISOString(),
  type: 'task.completed',
  participants: ['alice', 'bob'],
  impact: { trust: 0.1, affinity: 0.05 },
  description: 'Co-delivered Q1 report',
  source: 'openclaw:session-abc',
});

// 便捷 API: 按 from/to 自动查找（不存在则创建 emerged 关系）
graph.applyEventBetween('alice', 'bob', {
  type: 'task.failed',
  impact: { trust: -0.1, reliability: -0.15 },
});
```

### 关系记忆

```
RelationshipMemory
|-- shortTerm: RelationshipEvent[]       <-- 最近 50 条完整事件
|-- longTerm:
|   |-- patterns: Pattern[]             <-- "频繁合作", "关系改善中"
|   |-- keyMoments: RelationshipEvent[] <-- 影响最大的 5 个事件
|   |-- summary: string                 <-- 自然语言摘要（可接 LLM）
|   '-- interactionCount: number
'-- valence: number                      <-- 情感基调 EMA (-1 ~ +1)
```

自定义摘要生成器（比如接 LLM）：

```typescript
const consolidator = new MemoryConsolidator({
  summaryGenerator: (rel) => callLLM(`Summarize: ${JSON.stringify(rel.memory)}`),
  minEvents: 10,       // 至少 10 个事件才触发固化
  maxKeyMoments: 3,    // 保留 3 个关键时刻
});
```

### 模板系统

16 种内置模板，每种自带维度预设 + 演化规则：

| 模板 | 描述 | 核心维度 | 示例规则 |
|------|------|----------|---------|
| `superior` | 上级 | authority(0.7), trust(0.5), accountability(0.6) | `task.*` -> authority +0.05 |
| `subordinate` | 下属 | authority(-0.3), trust(0.5), dependence(0.4) | `task.completed` -> trust +0.08 |
| `peer` | 平级 | trust(0.5), affinity(0.4), respect(0.4) | `collaboration.success` -> trust +0.08 |
| `competitive` | 竞争 | rivalry(0.5), respect(0.3), trust(0.2) | `competition.won` -> rivalry +0.1 |
| `ally` | 联盟 | trust(0.6), affinity(0.5), loyalty(0.4) | `alliance.betrayed` -> trust -0.4 |
| `rival` | 对手 | rivalry(0.6), respect(0.3), trust(-0.2) | `competition.won` -> rivalry +0.1 |
| `mentor` | 导师 | authority(0.5), trust(0.6), knowledge_transfer(0.5) | `teaching.provided` -> knowledge +0.1 |
| `advisor` / `advises` | 顾问 | influence(0.5), trust(0.5), respect(0.4) | `advice.followed` -> influence +0.08 |
| `reviewer` | 审核 | authority(0.5), trust(0.4), rigor(0.5) | `review.approved` -> trust +0.05 |
| `delegate` | 委派 | trust(0.5), authority(0.4), reliability(0.5) | `delegation.completed` -> trust +0.1 |
| `serves` | 服务 | loyalty(0.7), trust(0.5), devotion(0.5) | `service.praised` -> loyalty +0.08 |
| `collaborates` | 合作 | trust(0.5), synergy(0.4), communication(0.4) | `collaboration.success` -> synergy +0.1 |
| `supervises` | 管理 | authority(0.6), trust(0.5), empowerment(0.4) | `supervision.delegated` -> empowerment +0.08 |
| `competes` | 竞赛 | rivalry(0.5), respect(0.3), trust(0.2) | 同 competitive |
| `audits` | 审计 | authority(0.5), trust(0.3), transparency(0.5) | `audit.clean` -> trust +0.1 |

自定义模板：

```typescript
import { registerTemplate, registerTemplates, listTemplates } from '@agents-uni/rel';

registerTemplate({
  name: 'palace-concubine',
  description: '后宫嫔妃关系',
  dimensions: [
    { type: 'favor', value: 0.5, volatility: 0.6 },
    { type: 'jealousy', value: 0.3, volatility: 0.5 },
    { type: 'alliance_strength', value: 0.4 },
  ],
  rules: [
    { on: 'imperial_favor.gained', adjust: { favor: 0.15, jealousy: 0.1 } },
    { on: 'imperial_favor.lost', adjust: { favor: -0.2, jealousy: -0.05 } },
    { on: 'scheme.exposed', adjust: { alliance_strength: -0.3, favor: -0.1 } },
  ],
  tags: ['palace', 'zhenhuan'],
});

// 批量注册
registerTemplates([template1, template2]);

// 查询
console.log(listTemplates()); // ['superior', 'subordinate', ..., 'palace-concubine']
```

### 涌现检测

5 种内置涌现规则 + 自定义：

| 规则 | 触发条件 | 创建的关系 |
|------|---------|-----------|
| `frequent-collaboration` | >=3 次 collaboration / task.completed | trust(0.4) + synergy(0.3) |
| `repeated-competition` | >=3 次 competition / contest | rivalry(0.4) + respect(0.2) |
| `escalating-conflict` | >=2 次 conflict / dispute / betray | trust(-0.3) + rivalry(0.5) |
| `knowledge-sharing` | >=3 次 teaching / mentoring / knowledge | knowledge_transfer(0.5) + trust(0.3) |
| `mutual-support` | >=3 次 alliance / support / help | trust(0.5) + loyalty(0.4) + affinity(0.4) |

```typescript
const detector = new EmergenceDetector(graph, {
  autoCreate: true,       // 检测到即创建（默认 true）
  includeBuiltin: true,   // 包含内置规则（默认 true）
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

// processEvent 一站式处理：
//   已有关系 -> applyEvent 到图
//   无关系   -> 缓冲 -> 模式匹配 -> 涌现创建
const emergences = detector.processEvent(event);
```

### 时间衰减

不活跃的关系会向中性衰减，速率与 volatility 成正比：

```typescript
// 对所有超过 1 天未更新的关系施加衰减
const decayedCount = graph.applyDecay(0.01); // decayRate
// value > 0 缩向 0，value < 0 涨向 0
// confidence 同步衰减（数据变陈旧）
```

### 社交网络分析

```typescript
import {
  computeInfluence,
  detectClusters,
  analyzeStructure,
  queryRelationships,
} from '@agents-uni/rel';

// === 影响力排名 ===
const scores = computeInfluence(graph, 'trust');
// [
//   { agentId: 'alice', score: 0.87, components: {
//       degreeCentrality: 0.8,
//       weightedInfluence: 0.9,
//       bridgingBonus: 0.5
//   }},
//   ...
// ]

// === 社区检测 ===
const clusters = detectClusters(graph, 'trust', 0.3);
// { clusters: [{ id: 'cluster-0', members: ['alice', 'bob'], cohesion: 0.65 }] }

// === 结构分析 ===
const analysis = analyzeStructure(graph);
// {
//   agentCount: 5,  relationshipCount: 8,  density: 0.4,
//   clusterCount: 2,  averageDegree: 3.2,
//   hub: { agentId: 'alice', degree: 5 },
//   mostTrusted: { agentId: 'bob', totalTrust: 1.8 },
//   mostRival: { agentId: 'charlie', totalRivalry: 1.2 },
//   graphValence: 0.35,
// }

// === 复杂查询 ===
const results = queryRelationships(graph, {
  from: 'alice',                                // 来源筛选
  minDimension: { type: 'trust', value: 0.5 },  // 维度下限
  minValence: 0,                                // 最小情感基调
  origin: 'declared',                           // 来源类型
  tag: 'ally',                                  // 标签匹配
});
// 返回 { relationship, strength }[]，按 strength 降序
```

---

## 持久化

```typescript
// 导出完整图状态
const snapshot = graph.toJSON();
// { relationships: [{ id, from, to, dimensions, memory, origin, ... }, ...] }

import fs from 'node:fs';
fs.writeFileSync('graph.json', JSON.stringify(snapshot));

// 恢复
const data = JSON.parse(fs.readFileSync('graph.json', 'utf-8'));
const restored = RelationshipGraph.fromJSON(data, { maxShortTerm: 100 });

// 简化邻接表（用于可视化 / 兼容旧系统）
const adj = graph.toAdjacencyList();
// { 'alice': [{ to: 'bob', dimensions: { trust: 0.68 }, valence: 0.35 }] }
```

---

## OpenClaw 集成

```typescript
import { OpenClawMemoryAdapter, generateSoulRelationshipSection } from '@agents-uni/rel';

// 从 OpenClaw session 文件提取事件
const adapter = new OpenClawMemoryAdapter({
  openclawDir: '~/.openclaw',          // 默认路径
  inferEvent: (content) => ({ ... }),   // 可自定义事件推断逻辑
});
const events = await adapter.fetchEvents('2026-01-01T00:00:00Z');

// 将关系上下文写回 agent workspace
await adapter.writeContext('zhenhuan', context);
// -> ~/.openclaw/workspace-zhenhuan/RELATIONSHIPS.md

// 生成 SOUL.md 关系section（中文 / 英文）
const section = generateSoulRelationshipSection(context, 'zh');
```

## 与 agents-uni-core 集成

`@agents-uni/core` 内置了 rel 桥接层：

```typescript
import {
  createRelEngine,
  createRelGraph,
  generateEnhancedRelationshipSection,
} from '@agents-uni/core';

// 从 UniverseConfig 一键创建完整引擎
const { graph, evolution, consolidator, emergence } = createRelEngine(universeConfig);

// 或只创建图
const graph = createRelGraph(universeConfig.relationships);

// 在 SOUL.md 生成中使用增强关系section
const section = generateEnhancedRelationshipSection(agent, universe, graph, 'zh');
```

## 向后兼容

100% 兼容 agents-uni-core 的 YAML 关系定义：

```typescript
import { fromLegacy, fromLegacyArray, fromYamlObject } from '@agents-uni/rel';

// 单条
const seed = fromLegacy({ from: 'a', to: 'b', type: 'ally', weight: 0.9 });

// 批量
const seeds = fromLegacyArray([
  { from: 'emperor', to: 'empress', type: 'superior', weight: 0.9 },
  { from: 'zhenhuan', to: 'emperor', type: 'serves' },
  { from: 'zhenhuan', to: 'huafei', type: 'rival', weight: 0.8 },
]);
const graph = new RelationshipGraph(seeds);

// 从 YAML 对象
const seed2 = fromYamlObject({ from: 'a', to: 'b', type: 'peer', weight: 0.5 });
```

---

## API 速查

### 类

| 类 | 构造参数 | 描述 |
|----|---------|------|
| `RelationshipGraph` | `(seeds?, options?)` | 多维有向关系图 |
| `EvolutionEngine` | `(graph)` | 事件 -> 模板规则 -> 维度调整 |
| `MemoryConsolidator` | `(options?)` | 短期 -> 长期模式 + 摘要 |
| `EmergenceDetector` | `(graph, options?)` | 交互模式 -> 新关系 |
| `OpenClawMemoryAdapter` | `(options?)` | OpenClaw session -> Event |

### RelationshipGraph 方法

| 方法 | 描述 |
|------|------|
| `addFromSeed(seed)` | 从种子创建关系，返回 `Relationship` |
| `get(id)` | 按 ID 查询 |
| `getOutgoing(agentId)` | 出边列表 |
| `getIncoming(agentId)` | 入边列表 |
| `getAll(agentId)` | 双向所有边 |
| `getBetween(from, to)` | 两人之间所有边（双向） |
| `getByDimension(agentId, dimType, minValue?)` | 按维度类型和阈值筛选 |
| `getDimensionValue(from, to, dimType)` | 取单一维度值 |
| `getStrongestConnections(agentId, dimType?, limit?)` | 最强 N 条连接 |
| `getAllAgentIds()` | 所有节点 ID |
| `getAllRelationships()` | 所有边 |
| `size` | 边总数 (getter) |
| `applyEvent(relId, event)` | 施加事件到指定关系 |
| `applyEventBetween(from, to, partialEvent)` | 按端点施加（不存在则创建） |
| `findPath(from, to, dimType?)` | BFS 最短路径 |
| `applyDecay(rate?)` | 时间衰减 |
| `toJSON()` | 导出完整状态 |
| `fromJSON(data, options?)` | 静态方法，从 JSON 恢复 |
| `toAdjacencyList()` | 邻接表导出 |

### EvolutionEngine 方法

| 方法 | 描述 |
|------|------|
| `processEvent(from, to, eventType, options?)` | 处理双人事件，返回 `EvolutionResult[]` |
| `processGroupEvent(agentIds, eventType, options?)` | 多人事件（两两配对） |
| `addGlobalRule(rule)` | 添加全局演化规则 |

### 工具函数

| 函数 | 描述 |
|------|------|
| `registerTemplate(t)` | 注册自定义模板 |
| `registerTemplates(ts)` | 批量注册 |
| `resolveTemplate(name)` | 查找模板（优先自定义） |
| `listTemplates()` | 列出所有模板名 |
| `getBuiltinTemplates()` | 获取内置模板 Map |
| `fromLegacy(def)` | 旧格式单条转换 |
| `fromLegacyArray(defs)` | 旧格式批量转换 |
| `fromYamlObject(obj)` | YAML 对象转换 |
| `computeInfluence(graph, dimType?)` | 影响力排名 |
| `detectClusters(graph, dimType?, minValue?)` | 社区检测 |
| `analyzeStructure(graph)` | 结构分析 |
| `queryRelationships(graph, filter)` | 复杂查询 |
| `formatRelationshipContext(ctx)` | Markdown 关系报告 |
| `generateSoulRelationshipSection(ctx, lang?)` | SOUL.md 关系 section |

---

## 架构

```
                          +-----------------+
                          |  universe.yaml  |
                          +--------+--------+
                                   |
                            fromLegacyArray()
                                   v
+----------+    addFromSeed()    +------------------+
| Templates | -----------------> | RelationshipGraph |
| (16 种)   |   resolve dims     | (multi-dim edges) |
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

## 设计哲学

1. **关系是一等公民** -- 不是图的附属品，而是有自己状态、记忆、历史的实体
2. **所有变更通过事件** -- 完整可审计、可重放、可持久化
3. **模板驱动 + 可涌现** -- 既支持预定义模式，也支持从交互中自然出现
4. **通用而非专用** -- 不绑定 OpenClaw / agents-uni / 任何特定框架

---

<a name="english"></a>

## English

**@agents-uni/rel** is a zero-dependency, multi-dimensional relationship engine for agent systems.

Traditional agent relationships are single weighted edges. This library models relationships as **living entities** with:

- **Multiple dimensions** (trust, authority, rivalry, affinity -- each independent)
- **Event sourcing** (all mutations through auditable `RelationshipEvent`s)
- **Memory** (short-term events consolidate into long-term patterns, key moments, and summaries)
- **Emergence** (undeclared relationships auto-detected from interaction patterns)
- **Social network analysis** (influence ranking, community detection, structural analysis)

### Quick Example

```typescript
import { RelationshipGraph, EvolutionEngine, EmergenceDetector } from '@agents-uni/rel';

const graph = new RelationshipGraph();
graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

const engine = new EvolutionEngine(graph);
engine.processEvent('alice', 'bob', 'alliance.supported');
// trust: 0.60 -> 0.68, loyalty: 0.40 -> 0.50

const detector = new EmergenceDetector(graph);
// After 3+ collaboration events between unknown pairs, a relationship emerges automatically
```

### Key Classes

| Class | Purpose |
|-------|---------|
| `RelationshipGraph` | Multi-dimensional directed graph with event processing, pathfinding, decay, serialization |
| `EvolutionEngine` | Maps events to template rules, computes dimension adjustments |
| `MemoryConsolidator` | Compresses short-term events into long-term patterns and summaries |
| `EmergenceDetector` | Auto-discovers relationships from interaction patterns (5 builtin + custom rules) |
| `OpenClawMemoryAdapter` | Reads OpenClaw session files, converts to `RelationshipEvent`s |

### 16 Built-in Templates

`superior`, `subordinate`, `peer`, `competitive`, `ally`, `rival`, `mentor`, `advisor`, `reviewer`, `delegate`, `serves`, `collaborates`, `supervises`, `competes`, `audits`, `advises`

Each template includes default dimensions and evolution rules triggered by event patterns (glob matching supported, e.g. `task.*`).

### Full API

See the Chinese documentation above for complete API reference with method signatures.

---

## 相关项目 / Related Projects

- [**@agents-uni/core**](https://github.com/agents-uni/core) -- Agent 组织协议层 / Agent organization protocol layer
- [**@agents-uni/zhenhuan**](https://github.com/agents-uni/zhenhuan) -- 甄嬛后宫 Agent 竞技 / Palace drama agent competition
- [**OpenClaw**](https://github.com/anthropics/openclaw) -- Agent 运行时 / Agent runtime

## License

MIT
