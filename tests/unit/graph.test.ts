import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../../src/graph/relationship-graph.js';

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  // ── Seed / Create ────────────────────────────

  describe('addFromSeed', () => {
    it('should create relationship from template type', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

      expect(rel.from).toBe('alice');
      expect(rel.to).toBe('bob');
      expect(rel.origin).toBe('declared');
      expect(rel.dimensions.length).toBeGreaterThan(0);

      const trustDim = rel.dimensions.find(d => d.type === 'trust');
      expect(trustDim).toBeDefined();
      expect(trustDim!.value).toBe(0.6);
    });

    it('should create relationship from explicit dimensions', () => {
      const rel = graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [
          { type: 'trust', value: 0.8 },
          { type: 'affinity', value: -0.3 },
        ],
      });

      expect(rel.dimensions).toHaveLength(2);
      expect(rel.dimensions.find(d => d.type === 'trust')!.value).toBe(0.8);
      expect(rel.dimensions.find(d => d.type === 'affinity')!.value).toBe(-0.3);
    });

    it('should create generic relationship when no type or dimensions', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob' });

      expect(rel.dimensions).toHaveLength(1);
      expect(rel.dimensions[0].type).toBe('affinity');
      expect(rel.dimensions[0].value).toBe(0.5);
    });

    it('should use weight as default value for generic relationship', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', weight: 0.9 });

      expect(rel.dimensions[0].value).toBe(0.9);
    });

    it('should clamp dimension values to [-1, 1]', () => {
      const rel = graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [{ type: 'trust', value: 1.5 }],
      });

      expect(rel.dimensions[0].value).toBe(1);
    });

    it('should create fallback dimension for unknown template type', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'custom_unknown' });

      expect(rel.dimensions).toHaveLength(1);
      expect(rel.dimensions[0].type).toBe('custom_unknown');
    });

    it('should initialize empty memory', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      expect(rel.memory.shortTerm).toHaveLength(0);
      expect(rel.memory.longTerm.interactionCount).toBe(0);
      expect(rel.memory.longTerm.patterns).toHaveLength(0);
      expect(rel.memory.valence).toBe(0);
    });

    it('should preserve tags and include template type', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer', tags: ['team-alpha'] });

      expect(rel.tags).toContain('team-alpha');
      expect(rel.tags).toContain('peer'); // template name is also stored as tag
    });
  });

  describe('constructor with seeds', () => {
    it('should create multiple relationships from constructor seeds', () => {
      const g = new RelationshipGraph([
        { from: 'alice', to: 'bob', type: 'peer' },
        { from: 'bob', to: 'charlie', type: 'competitive' },
      ]);

      expect(g.size).toBe(2);
    });
  });

  // ── Query ────────────────────────────────────

  describe('queries', () => {
    beforeEach(() => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'rival' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });
    });

    it('should get relationship by ID', () => {
      const rel = graph.addFromSeed({ from: 'x', to: 'y', type: 'peer' });
      expect(graph.get(rel.id)).toBe(rel);
    });

    it('should return undefined for unknown ID', () => {
      expect(graph.get('nonexistent')).toBeUndefined();
    });

    it('should get outgoing relationships', () => {
      const rels = graph.getOutgoing('alice');
      expect(rels).toHaveLength(2);
      expect(rels.map(r => r.to).sort()).toEqual(['bob', 'charlie']);
    });

    it('should get incoming relationships', () => {
      const rels = graph.getIncoming('charlie');
      expect(rels).toHaveLength(2);
      expect(rels.map(r => r.from).sort()).toEqual(['alice', 'bob']);
    });

    it('should get all relationships for an agent', () => {
      const rels = graph.getAll('bob');
      // 1 outgoing (bob→charlie) + 1 incoming (alice→bob)
      expect(rels).toHaveLength(2);
    });

    it('should get relationships between two agents', () => {
      const rels = graph.getBetween('alice', 'bob');
      expect(rels.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for no relationships', () => {
      expect(graph.getOutgoing('nobody')).toHaveLength(0);
      expect(graph.getIncoming('nobody')).toHaveLength(0);
    });

    it('should get all agent IDs', () => {
      const ids = graph.getAllAgentIds().sort();
      expect(ids).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should get all relationships', () => {
      expect(graph.getAllRelationships()).toHaveLength(3);
    });

    it('should report correct size', () => {
      expect(graph.size).toBe(3);
    });

    it('should get by dimension type', () => {
      const results = graph.getByDimension('alice', 'trust');
      expect(results.length).toBeGreaterThan(0);
      // ally trust is 0.6, rival trust is -0.2
      expect(results[0].agentId).toBe('bob'); // higher trust
    });

    it('should get by dimension with min value filter', () => {
      const results = graph.getByDimension('alice', 'trust', 0.5);
      expect(results.length).toBe(1);
      expect(results[0].agentId).toBe('bob');
    });

    it('should get dimension value between two agents', () => {
      const value = graph.getDimensionValue('alice', 'bob', 'trust');
      expect(value).toBe(0.6);
    });

    it('should return undefined for non-existent dimension', () => {
      expect(graph.getDimensionValue('alice', 'bob', 'nonexistent')).toBeUndefined();
    });
  });

  // ── Event Processing ─────────────────────────

  describe('applyEvent', () => {
    it('should update existing dimension values', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

      const trustBefore = rel.dimensions.find(d => d.type === 'trust')!.value;

      graph.applyEvent(rel.id, {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'test',
        participants: ['alice', 'bob'],
        impact: { trust: 0.1 },
      });

      const trustAfter = rel.dimensions.find(d => d.type === 'trust')!.value;
      expect(trustAfter).toBeCloseTo(trustBefore + 0.1, 5);
    });

    it('should clamp dimension values after event', () => {
      const rel = graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [{ type: 'trust', value: 0.95 }],
      });

      graph.applyEvent(rel.id, {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'test',
        participants: ['alice', 'bob'],
        impact: { trust: 0.2 },
      });

      expect(rel.dimensions.find(d => d.type === 'trust')!.value).toBe(1);
    });

    it('should create new dimension if impact references unknown dimension', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      graph.applyEvent(rel.id, {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'test',
        participants: ['alice', 'bob'],
        impact: { rivalry: 0.3 },
      });

      const rivalryDim = rel.dimensions.find(d => d.type === 'rivalry');
      expect(rivalryDim).toBeDefined();
      expect(rivalryDim!.value).toBe(0.3);
      expect(rivalryDim!.source).toBe('evolved');
    });

    it('should add event to short-term memory', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      graph.applyEvent(rel.id, {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'test',
        participants: ['alice', 'bob'],
        impact: { trust: 0.1 },
      });

      expect(rel.memory.shortTerm).toHaveLength(1);
      expect(rel.memory.longTerm.interactionCount).toBe(1);
    });

    it('should trim short-term memory when exceeding maxShortTerm', () => {
      const g = new RelationshipGraph([], { maxShortTerm: 3 });
      const rel = g.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      for (let i = 0; i < 5; i++) {
        g.applyEvent(rel.id, {
          id: `evt-${i}`,
          timestamp: new Date().toISOString(),
          type: 'test',
          participants: ['alice', 'bob'],
          impact: { trust: 0.01 },
        });
      }

      expect(rel.memory.shortTerm).toHaveLength(3);
      expect(rel.memory.longTerm.interactionCount).toBe(5);
    });

    it('should update valence based on event impact', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      graph.applyEvent(rel.id, {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'test',
        participants: ['alice', 'bob'],
        impact: { trust: 0.5 },
      });

      // Valence = 0 * 0.9 + 0.5 * 0.1 = 0.05
      expect(rel.memory.valence).toBeCloseTo(0.05, 5);
    });

    it('should return false for non-existent relationship', () => {
      const result = graph.applyEvent('nonexistent', {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'test',
        participants: ['alice', 'bob'],
        impact: { trust: 0.1 },
      });

      expect(result).toBe(false);
    });
  });

  describe('applyEventBetween', () => {
    it('should auto-create emerged relationship if none exists', () => {
      const rel = graph.applyEventBetween('alice', 'bob', {
        type: 'test.event',
        impact: { trust: 0.3 },
      });

      expect(rel.origin).toBe('emerged');
      expect(rel.from).toBe('alice');
      expect(rel.to).toBe('bob');
      expect(graph.size).toBe(1);
    });

    it('should apply to existing relationship', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });

      const rel = graph.applyEventBetween('alice', 'bob', {
        type: 'test.event',
        impact: { trust: 0.1 },
      });

      expect(rel.origin).toBe('declared');
      expect(graph.size).toBe(1); // no new relationship created
    });
  });

  // ── Path Finding ─────────────────────────────

  describe('findPath', () => {
    it('should find direct path', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

      const path = graph.findPath('alice', 'bob');
      expect(path).not.toBeNull();
      expect(path!.path).toEqual(['alice', 'bob']);
    });

    it('should find multi-hop path', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

      const path = graph.findPath('alice', 'charlie');
      expect(path).not.toBeNull();
      expect(path!.path).toEqual(['alice', 'bob', 'charlie']);
      expect(path!.relationships).toHaveLength(2);
    });

    it('should return null for unreachable nodes', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'charlie', to: 'dave', type: 'peer' });

      const path = graph.findPath('alice', 'dave');
      expect(path).toBeNull();
    });

    it('should handle self-path', () => {
      const path = graph.findPath('alice', 'alice');
      expect(path).not.toBeNull();
      expect(path!.path).toEqual(['alice']);
      expect(path!.cost).toBe(0);
    });
  });

  // ── Strongest Connections ─────────────────────

  describe('getStrongestConnections', () => {
    it('should return strongest trust connections', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'rival' });

      const strongest = graph.getStrongestConnections('alice', 'trust', 5);
      expect(strongest.length).toBe(2);
      // ally trust (0.6) > rival trust (-0.2)
      expect(strongest[0].agentId).toBe('bob');
    });
  });

  // ── Serialization ────────────────────────────

  describe('serialization', () => {
    it('should round-trip through JSON', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

      const json = graph.toJSON();
      const restored = RelationshipGraph.fromJSON(json);

      expect(restored.size).toBe(2);
      expect(restored.getOutgoing('alice')).toHaveLength(1);
      expect(restored.getOutgoing('bob')).toHaveLength(1);
    });

    it('should export adjacency list', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

      const adj = graph.toAdjacencyList();
      expect(adj['alice']).toHaveLength(1);
      expect(adj['alice'][0].to).toBe('bob');
      expect(adj['alice'][0].dimensions).toHaveProperty('trust');
    });
  });

  // ── Decay ────────────────────────────────────

  describe('applyDecay', () => {
    it('should decay stale relationships toward neutral', () => {
      const rel = graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [{ type: 'trust', value: 0.8, volatility: 0.5 }],
      });

      // Simulate old updatedAt (3 days ago)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      rel.updatedAt = threeDaysAgo;

      const decayed = graph.applyDecay(0.01);
      expect(decayed).toBe(1);
      expect(rel.dimensions[0].value).toBeLessThan(0.8);
    });

    it('should not decay recently updated relationships', () => {
      const rel = graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [{ type: 'trust', value: 0.8, volatility: 0.5 }],
      });

      // updatedAt is now
      const decayed = graph.applyDecay(0.01);
      expect(decayed).toBe(0);
      expect(rel.dimensions[0].value).toBe(0.8);
    });
  });
});
