import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../../src/graph/relationship-graph.js';
import { EmergenceDetector } from '../../src/emergence/detector.js';
import type { RelationshipEvent } from '../../src/schema/types.js';

function makeEvent(overrides: Partial<RelationshipEvent> = {}): RelationshipEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'interaction.general',
    participants: ['alice', 'bob'],
    impact: { affinity: 0.01 },
    ...overrides,
  };
}

describe('EmergenceDetector', () => {
  let graph: RelationshipGraph;
  let detector: EmergenceDetector;

  beforeEach(() => {
    graph = new RelationshipGraph();
    detector = new EmergenceDetector(graph);
  });

  describe('observe and detect', () => {
    it('should not detect with insufficient events', () => {
      detector.observe(makeEvent({ type: 'collaboration.success' }));
      detector.observe(makeEvent({ type: 'collaboration.success' }));

      const results = detector.detect();
      expect(results).toHaveLength(0);
    });

    it('should detect frequent-collaboration pattern', () => {
      for (let i = 0; i < 4; i++) {
        detector.observe(makeEvent({
          type: 'collaboration.success',
          participants: ['alice', 'bob'],
        }));
      }

      const results = detector.detect();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('frequent-collaboration');
      expect(results[0].created).toBe(true);

      // Should have created a relationship in the graph
      expect(graph.getBetween('alice', 'bob').length).toBe(1);
    });

    it('should detect repeated-competition pattern', () => {
      for (let i = 0; i < 3; i++) {
        detector.observe(makeEvent({
          type: 'competition.occurred',
          participants: ['alice', 'charlie'],
        }));
      }

      const results = detector.detect();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('repeated-competition');
    });

    it('should detect escalating-conflict pattern', () => {
      detector.observe(makeEvent({
        type: 'conflict.major',
        participants: ['alice', 'bob'],
      }));
      detector.observe(makeEvent({
        type: 'conflict.escalated',
        participants: ['alice', 'bob'],
      }));

      const results = detector.detect();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('escalating-conflict');
    });

    it('should detect mutual-support pattern', () => {
      for (let i = 0; i < 3; i++) {
        detector.observe(makeEvent({
          type: 'alliance.supported',
          participants: ['alice', 'bob'],
        }));
      }

      const results = detector.detect();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('mutual-support');
    });

    it('should not create duplicate relationships', () => {
      // Pre-existing relationship
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      for (let i = 0; i < 5; i++) {
        detector.observe(makeEvent({
          type: 'collaboration.success',
          participants: ['alice', 'bob'],
        }));
      }

      const results = detector.detect();
      expect(results).toHaveLength(0); // Already has relationship
    });
  });

  describe('processEvent', () => {
    it('should apply events to existing relationships', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });
      const countBefore = rel.memory.longTerm.interactionCount;

      detector.processEvent(makeEvent({
        type: 'task.completed',
        participants: ['alice', 'bob'],
        impact: { trust: 0.1 },
      }));

      expect(rel.memory.longTerm.interactionCount).toBe(countBefore + 1);
    });

    it('should buffer events for new pairs and trigger emergence', () => {
      // Process 3 collaboration events for a new pair
      for (let i = 0; i < 3; i++) {
        const results = detector.processEvent(makeEvent({
          type: 'collaboration.success',
          participants: ['alice', 'charlie'],
        }));

        if (i === 2) {
          // Third event should trigger emergence
          expect(results.length).toBeGreaterThan(0);
          expect(results[0].created).toBe(true);
        }
      }

      // Now the relationship should exist
      expect(graph.getBetween('alice', 'charlie').length).toBe(1);
    });
  });

  describe('autoCreate option', () => {
    it('should not create relationships when autoCreate is false', () => {
      const manualDetector = new EmergenceDetector(graph, { autoCreate: false });

      for (let i = 0; i < 4; i++) {
        manualDetector.observe(makeEvent({
          type: 'collaboration.success',
          participants: ['alice', 'bob'],
        }));
      }

      const results = manualDetector.detect();
      expect(results).toHaveLength(1);
      expect(results[0].created).toBe(false);
      expect(graph.size).toBe(0); // No relationship created
    });
  });

  describe('custom rules', () => {
    it('should support custom emergence rules', () => {
      const customDetector = new EmergenceDetector(graph, {
        customRules: [{
          name: 'trade-partners',
          description: 'Agents that trade frequently',
          minEvents: 2,
          eventPatterns: ['trade.*'],
          detect: (events) => events.filter(e => e.type.includes('trade')).length >= 2,
          dimensions: [{ type: 'trade_bond', value: 0.5 }],
          tags: ['emerged', 'trade'],
        }],
      });

      customDetector.observe(makeEvent({
        type: 'trade.completed',
        participants: ['alice', 'bob'],
      }));
      customDetector.observe(makeEvent({
        type: 'trade.completed',
        participants: ['alice', 'bob'],
      }));

      const results = customDetector.detect();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('trade-partners');
    });
  });

  describe('bufferStats', () => {
    it('should report buffer statistics', () => {
      detector.observe(makeEvent({ participants: ['alice', 'bob'] }));
      detector.observe(makeEvent({ participants: ['alice', 'bob'] }));
      detector.observe(makeEvent({ participants: ['charlie', 'dave'] }));

      const stats = detector.getBufferStats();
      expect(stats).toHaveLength(2);
    });

    it('should clear buffer', () => {
      detector.observe(makeEvent({ participants: ['alice', 'bob'] }));
      detector.clearBuffer();

      expect(detector.getBufferStats()).toHaveLength(0);
    });
  });
});
