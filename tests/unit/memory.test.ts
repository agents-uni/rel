import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryConsolidator } from '../../src/memory/consolidator.js';
import { RelationshipGraph } from '../../src/graph/relationship-graph.js';
import type { Relationship, RelationshipEvent } from '../../src/schema/types.js';

function makeEvent(overrides: Partial<RelationshipEvent> = {}): RelationshipEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'test.event',
    participants: ['alice', 'bob'],
    impact: { trust: 0.1 },
    ...overrides,
  };
}

describe('MemoryConsolidator', () => {
  let consolidator: MemoryConsolidator;
  let graph: RelationshipGraph;

  beforeEach(() => {
    consolidator = new MemoryConsolidator({ minEvents: 3, maxKeyMoments: 3 });
    graph = new RelationshipGraph();
  });

  describe('consolidate', () => {
    it('should skip consolidation when below minimum events', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      // Only 2 events (below minEvents=3)
      graph.applyEvent(rel.id, makeEvent());
      graph.applyEvent(rel.id, makeEvent());

      const result = consolidator.consolidate(rel);
      expect(result.patternsDetected).toHaveLength(0);
      expect(result.keyMomentsUpdated).toBe(false);
      expect(result.summaryUpdated).toBe(false);
    });

    it('should detect patterns when enough events exist', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      // Add 5 events with same type → should detect frequent pattern
      for (let i = 0; i < 5; i++) {
        graph.applyEvent(rel.id, makeEvent({ type: 'task.completed' }));
      }

      const result = consolidator.consolidate(rel);
      expect(result.patternsDetected.length).toBeGreaterThan(0);
    });

    it('should update key moments from high-impact events', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      // Add events with varying impact
      graph.applyEvent(rel.id, makeEvent({ impact: { trust: 0.01 } }));
      graph.applyEvent(rel.id, makeEvent({ impact: { trust: 0.5 } })); // high impact
      graph.applyEvent(rel.id, makeEvent({ impact: { trust: 0.02 } }));
      graph.applyEvent(rel.id, makeEvent({ impact: { trust: 0.8 } })); // highest impact
      graph.applyEvent(rel.id, makeEvent({ impact: { trust: 0.03 } }));

      const result = consolidator.consolidate(rel);
      expect(result.keyMomentsUpdated).toBe(true);
      expect(rel.memory.longTerm.keyMoments.length).toBeLessThanOrEqual(3);
    });

    it('should update summary', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      for (let i = 0; i < 5; i++) {
        graph.applyEvent(rel.id, makeEvent());
      }

      const result = consolidator.consolidate(rel);
      expect(result.summaryUpdated).toBe(true);
      expect(rel.memory.longTerm.summary.length).toBeGreaterThan(0);
      expect(rel.memory.longTerm.summary).toContain('alice');
      expect(rel.memory.longTerm.summary).toContain('bob');
    });

    it('should support custom summary generator', () => {
      const customConsolidator = new MemoryConsolidator({
        minEvents: 3,
        summaryGenerator: (rel) => `Custom summary for ${rel.from}-${rel.to}`,
      });

      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });
      for (let i = 0; i < 5; i++) {
        graph.applyEvent(rel.id, makeEvent());
      }

      customConsolidator.consolidate(rel);
      expect(rel.memory.longTerm.summary).toBe('Custom summary for alice-bob');
    });
  });

  describe('consolidateAll', () => {
    it('should consolidate all eligible relationships in graph', () => {
      const rel1 = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });
      const rel2 = graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'ally' });

      // Give rel1 enough events
      for (let i = 0; i < 5; i++) {
        graph.applyEvent(rel1.id, makeEvent({ type: 'task.completed' }));
      }

      // Give rel2 only 1 event (below threshold)
      graph.applyEvent(rel2.id, makeEvent());

      const results = consolidator.consolidateAll(graph);

      // Only rel1 should produce a result
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.relationshipId === rel1.id)).toBe(true);
    });

    it('should return empty array when nothing to consolidate', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      const results = consolidator.consolidateAll(graph);
      expect(results).toHaveLength(0);
    });
  });

  describe('pattern detection', () => {
    it('should detect frequent event type patterns', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      // 4 task.completed + 1 different → freq=4/5=0.8
      for (let i = 0; i < 4; i++) {
        graph.applyEvent(rel.id, makeEvent({ type: 'task.completed' }));
      }
      graph.applyEvent(rel.id, makeEvent({ type: 'other.event' }));

      const result = consolidator.consolidate(rel);
      const taskPattern = result.patternsDetected.find(p =>
        p.type.includes('task')
      );
      expect(taskPattern).toBeDefined();
      expect(taskPattern!.description).toContain('task.completed');
    });

    it('should detect positive outcome patterns', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      for (let i = 0; i < 4; i++) {
        graph.applyEvent(rel.id, makeEvent({ type: 'competition.won' }));
      }
      graph.applyEvent(rel.id, makeEvent({ type: 'other' }));

      const result = consolidator.consolidate(rel);
      const wonPattern = result.patternsDetected.find(p =>
        p.description.includes('positive outcome')
      );
      expect(wonPattern).toBeDefined();
    });

    it('should detect negative/conflict patterns', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      for (let i = 0; i < 4; i++) {
        graph.applyEvent(rel.id, makeEvent({ type: 'team.conflict' }));
      }
      graph.applyEvent(rel.id, makeEvent({ type: 'other' }));

      const result = consolidator.consolidate(rel);
      const conflictPattern = result.patternsDetected.find(p =>
        p.description.includes('tension')
      );
      expect(conflictPattern).toBeDefined();
    });
  });
});
