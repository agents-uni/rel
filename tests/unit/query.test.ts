import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../../src/graph/relationship-graph.js';
import {
  computeInfluence,
  detectClusters,
  analyzeStructure,
  queryRelationships,
} from '../../src/query/analyzer.js';

describe('Social Network Analyzer', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  describe('computeInfluence', () => {
    it('should return empty for empty graph', () => {
      expect(computeInfluence(graph)).toHaveLength(0);
    });

    it('should rank agents by influence', () => {
      // Hub topology: alice has many connections
      graph.addFromSeed({ from: 'bob', to: 'alice', type: 'ally' });
      graph.addFromSeed({ from: 'charlie', to: 'alice', type: 'ally' });
      graph.addFromSeed({ from: 'dave', to: 'alice', type: 'peer' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

      const scores = computeInfluence(graph, 'trust');
      expect(scores.length).toBeGreaterThan(0);

      // alice should have highest score (most incoming trust)
      expect(scores[0].agentId).toBe('alice');
      expect(scores[0].score).toBeGreaterThan(0);
    });

    it('should compute all component scores', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'peer' });
      graph.addFromSeed({ from: 'bob', to: 'alice', type: 'peer' });

      const scores = computeInfluence(graph);
      expect(scores[0].components).toHaveProperty('degreeCentrality');
      expect(scores[0].components).toHaveProperty('weightedInfluence');
      expect(scores[0].components).toHaveProperty('bridgingBonus');
    });
  });

  describe('detectClusters', () => {
    it('should detect single cluster for fully connected graph', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'ally' });

      const result = detectClusters(graph, 'trust', 0);
      expect(result.clusters.length).toBe(1);
      expect(result.clusters[0].members.sort()).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should detect multiple clusters for disconnected groups', () => {
      // Group 1
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      // Group 2
      graph.addFromSeed({ from: 'charlie', to: 'dave', type: 'ally' });

      const result = detectClusters(graph, 'trust', 0);
      expect(result.clusters.length).toBe(2);
    });

    it('should separate by dimension value threshold', () => {
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [{ type: 'trust', value: 0.8 }],
      });
      graph.addFromSeed({
        from: 'bob',
        to: 'charlie',
        dimensions: [{ type: 'trust', value: 0.1 }],
      });

      // With high threshold, bob-charlie connection is too weak
      const result = detectClusters(graph, 'trust', 0.5);
      expect(result.clusters.length).toBeGreaterThanOrEqual(2);
    });

    it('should compute cohesion score', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'bob', to: 'alice', type: 'ally' });

      const result = detectClusters(graph, 'trust', 0);
      expect(result.clusters[0].cohesion).toBeGreaterThan(0);
    });
  });

  describe('analyzeStructure', () => {
    it('should analyze empty graph', () => {
      const analysis = analyzeStructure(graph);
      expect(analysis.agentCount).toBe(0);
      expect(analysis.relationshipCount).toBe(0);
      expect(analysis.density).toBe(0);
    });

    it('should compute all structural metrics', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'rival' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

      const analysis = analyzeStructure(graph);

      expect(analysis.agentCount).toBe(3);
      expect(analysis.relationshipCount).toBe(3);
      expect(analysis.density).toBeGreaterThan(0);
      expect(analysis.averageDegree).toBeGreaterThan(0);
      expect(analysis.hub).not.toBeNull();
      expect(analysis.hub!.agentId).toBe('alice'); // 2 outgoing
      expect(analysis.clusterCount).toBeGreaterThanOrEqual(1);
    });

    it('should identify most trusted agent', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'charlie', to: 'bob', type: 'ally' });

      const analysis = analyzeStructure(graph);
      expect(analysis.mostTrusted).not.toBeNull();
      expect(analysis.mostTrusted!.agentId).toBe('bob');
    });
  });

  describe('queryRelationships', () => {
    beforeEach(() => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'rival' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });
    });

    it('should filter by from agent', () => {
      const results = queryRelationships(graph, { from: 'alice' });
      expect(results).toHaveLength(2);
    });

    it('should filter by to agent', () => {
      const results = queryRelationships(graph, { to: 'charlie' });
      expect(results).toHaveLength(2);
    });

    it('should filter by tag', () => {
      const results = queryRelationships(graph, { tag: 'ally' });
      expect(results).toHaveLength(1);
    });

    it('should filter by minimum dimension value', () => {
      const results = queryRelationships(graph, {
        minDimension: { type: 'trust', value: 0.5 },
      });
      // ally trust=0.6, rival trust=-0.2, peer trust=0.5
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return results sorted by strength', () => {
      const results = queryRelationships(graph, {});
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].strength).toBeGreaterThanOrEqual(results[i].strength);
      }
    });

    it('should filter by origin', () => {
      // All seeded relationships are 'declared'
      const declared = queryRelationships(graph, { origin: 'declared' });
      expect(declared).toHaveLength(3);

      const emerged = queryRelationships(graph, { origin: 'emerged' });
      expect(emerged).toHaveLength(0);
    });

    it('should return empty for no matches', () => {
      const results = queryRelationships(graph, { from: 'nobody' });
      expect(results).toHaveLength(0);
    });
  });
});
