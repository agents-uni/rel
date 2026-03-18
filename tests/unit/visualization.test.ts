import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../../src/graph/relationship-graph.js';

describe('toVisualizationData', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  it('should return empty data for empty graph', () => {
    const viz = graph.toVisualizationData();
    expect(viz.nodes).toHaveLength(0);
    expect(viz.edges).toHaveLength(0);
    expect(viz.clusters).toHaveLength(0);
    expect(viz.generatedAt).toBeDefined();
  });

  it('should produce nodes for all agents', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

    const viz = graph.toVisualizationData();
    const nodeIds = viz.nodes.map(n => n.id).sort();
    expect(nodeIds).toEqual(['alice', 'bob', 'charlie']);
  });

  it('should include influence scores on nodes', () => {
    graph.addFromSeed({ from: 'bob', to: 'alice', type: 'ally' });
    graph.addFromSeed({ from: 'charlie', to: 'alice', type: 'ally' });

    const viz = graph.toVisualizationData();
    const aliceNode = viz.nodes.find(n => n.id === 'alice');
    expect(aliceNode).toBeDefined();
    expect(aliceNode!.influence).toBeGreaterThan(0);
  });

  it('should include connection counts on nodes', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    graph.addFromSeed({ from: 'alice', to: 'charlie', type: 'peer' });

    const viz = graph.toVisualizationData();
    const aliceNode = viz.nodes.find(n => n.id === 'alice');
    expect(aliceNode!.connectionCount).toBe(2);
  });

  it('should produce edges for all relationships', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'rival' });

    const viz = graph.toVisualizationData();
    expect(viz.edges).toHaveLength(2);

    const aliceBob = viz.edges.find(e => e.from === 'alice' && e.to === 'bob');
    expect(aliceBob).toBeDefined();
    expect(aliceBob!.dimensions.length).toBeGreaterThan(0);
    expect(aliceBob!.strength).toBeGreaterThan(0);
  });

  it('should compute edge strength from dimension magnitudes', () => {
    graph.addFromSeed({
      from: 'alice',
      to: 'bob',
      dimensions: [{ type: 'trust', value: 0.9, confidence: 1.0 }],
    });

    const viz = graph.toVisualizationData();
    expect(viz.edges[0].strength).toBeCloseTo(0.9, 1);
  });

  it('should include interaction count on edges', () => {
    const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    // Apply some events to increase interaction count
    graph.applyEvent(rel.id, {
      id: 'evt-1',
      timestamp: new Date().toISOString(),
      type: 'task.completed',
      participants: ['alice', 'bob'],
      impact: { trust: 0.1 },
    });

    const viz = graph.toVisualizationData();
    const edge = viz.edges.find(e => e.from === 'alice');
    expect(edge!.interactionCount).toBe(1);
  });

  it('should detect clusters and assign clusterId to nodes', () => {
    // Two disconnected groups
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    graph.addFromSeed({ from: 'charlie', to: 'dave', type: 'ally' });

    const viz = graph.toVisualizationData({ clusterMinValue: 0 });
    expect(viz.clusters.length).toBe(2);

    // All nodes should have a clusterId
    for (const node of viz.nodes) {
      expect(node.clusterId).toBeDefined();
    }
  });

  it('should use agentMetadata for labels', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

    const viz = graph.toVisualizationData({
      agentMetadata: {
        alice: { name: 'Alice Smith', role: 'Engineer', department: 'Backend' },
        bob: { name: 'Bob Jones', role: 'Designer', department: 'Frontend' },
      },
    });

    const aliceNode = viz.nodes.find(n => n.id === 'alice');
    expect(aliceNode!.label).toBe('Alice Smith');
    expect(aliceNode!.role).toBe('Engineer');
    expect(aliceNode!.department).toBe('Backend');

    const bobNode = viz.nodes.find(n => n.id === 'bob');
    expect(bobNode!.label).toBe('Bob Jones');
  });

  it('should fall back to agent id when no metadata', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });

    const viz = graph.toVisualizationData();
    const aliceNode = viz.nodes.find(n => n.id === 'alice');
    expect(aliceNode!.label).toBe('alice');
    expect(aliceNode!.role).toBeUndefined();
  });

  it('should use custom cluster dimension type', () => {
    graph.addFromSeed({
      from: 'alice',
      to: 'bob',
      dimensions: [{ type: 'authority', value: 0.8 }],
    });

    const viz = graph.toVisualizationData({
      clusterDimensionType: 'authority',
      clusterMinValue: 0.5,
    });

    // With authority-based clustering, they should be in the same cluster
    expect(viz.clusters.length).toBe(1);
  });
});
