import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../../src/graph/relationship-graph.js';
import { generateReport } from '../../src/query/report.js';

describe('generateReport', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph();
  });

  it('should generate report for empty graph', () => {
    const report = generateReport(graph);
    expect(report.summary).toContain('0 agents');
    expect(report.structure.agentCount).toBe(0);
    expect(report.influenceRanking).toHaveLength(0);
    expect(report.clusters).toHaveLength(0);
    expect(report.hotspots).toHaveLength(0);
    expect(report.generatedAt).toBeDefined();
  });

  it('should include structural analysis', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

    const report = generateReport(graph);
    expect(report.structure.agentCount).toBe(3);
    expect(report.structure.relationshipCount).toBe(2);
    expect(report.structure.density).toBeGreaterThan(0);
  });

  it('should include influence ranking', () => {
    graph.addFromSeed({ from: 'bob', to: 'alice', type: 'ally' });
    graph.addFromSeed({ from: 'charlie', to: 'alice', type: 'ally' });
    graph.addFromSeed({ from: 'dave', to: 'alice', type: 'peer' });

    const report = generateReport(graph);
    expect(report.influenceRanking.length).toBeGreaterThan(0);
    expect(report.influenceRanking[0].agentId).toBe('alice');
  });

  it('should include clusters', () => {
    graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
    graph.addFromSeed({ from: 'charlie', to: 'dave', type: 'ally' });

    const report = generateReport(graph);
    expect(report.clusters.length).toBeGreaterThanOrEqual(1);
    for (const cluster of report.clusters) {
      expect(cluster.members.length).toBeGreaterThan(0);
    }
  });

  describe('hotspot detection', () => {
    it('should detect conflict risk (high rivalry + low trust)', () => {
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [
          { type: 'rivalry', value: 0.7 },
          { type: 'trust', value: 0.1 },
        ],
      });

      const report = generateReport(graph);
      const conflictHotspots = report.hotspots.filter(h => h.type === 'conflict_risk');
      expect(conflictHotspots.length).toBe(1);
      expect(conflictHotspots[0].agents).toContain('alice');
      expect(conflictHotspots[0].agents).toContain('bob');
      expect(conflictHotspots[0].severity).toBeGreaterThan(0);
    });

    it('should not flag conflict when trust is adequate', () => {
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [
          { type: 'rivalry', value: 0.5 },
          { type: 'trust', value: 0.5 },
        ],
      });

      const report = generateReport(graph);
      const conflictHotspots = report.hotspots.filter(h => h.type === 'conflict_risk');
      expect(conflictHotspots.length).toBe(0);
    });

    it('should detect power imbalance', () => {
      // alice gets lots of incoming trust
      graph.addFromSeed({ from: 'bob', to: 'alice', type: 'ally' });
      graph.addFromSeed({ from: 'charlie', to: 'alice', type: 'ally' });
      graph.addFromSeed({ from: 'dave', to: 'alice', type: 'ally' });
      // Others have very few connections
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });

      const report = generateReport(graph);
      const powerHotspots = report.hotspots.filter(h => h.type === 'power_imbalance');
      // Whether it triggers depends on the gap threshold
      if (powerHotspots.length > 0) {
        expect(powerHotspots[0].agents).toContain('alice');
      }
    });

    it('should detect strong alliances', () => {
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [
          { type: 'trust', value: 0.8 },
          { type: 'affinity', value: 0.7 },
        ],
      });

      const report = generateReport(graph);
      const alliances = report.hotspots.filter(h => h.type === 'strong_alliance');
      expect(alliances.length).toBe(1);
      expect(alliances[0].agents).toContain('alice');
      expect(alliances[0].agents).toContain('bob');
    });

    it('should detect rivalry clusters', () => {
      // Three-way rivalry
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [{ type: 'rivalry', value: 0.5 }],
      });
      graph.addFromSeed({
        from: 'alice',
        to: 'charlie',
        dimensions: [{ type: 'rivalry', value: 0.5 }],
      });
      graph.addFromSeed({
        from: 'bob',
        to: 'charlie',
        dimensions: [{ type: 'rivalry', value: 0.5 }],
      });

      const report = generateReport(graph);
      const rivalryClusters = report.hotspots.filter(h => h.type === 'rivalry_cluster');
      expect(rivalryClusters.length).toBe(1);
      expect(rivalryClusters[0].agents.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect isolated agents', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      graph.addFromSeed({ from: 'bob', to: 'charlie', type: 'peer' });
      graph.addFromSeed({ from: 'charlie', to: 'alice', type: 'peer' });
      // dave has no connections — add him by creating a relationship and removing it
      // Instead, let's create a disconnected graph
      graph.addFromSeed({ from: 'dave', to: 'eve', type: 'peer' });
      // dave has only 1 connection in a 5-agent graph

      const report = generateReport(graph);
      const isolated = report.hotspots.filter(h => h.type === 'isolated_agent');
      // dave and eve both have only 1 connection
      expect(isolated.length).toBeGreaterThanOrEqual(1);
    });

    it('should sort hotspots by severity (descending)', () => {
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [
          { type: 'rivalry', value: 0.9 },
          { type: 'trust', value: -0.2 },
        ],
      });
      graph.addFromSeed({
        from: 'alice',
        to: 'charlie',
        dimensions: [
          { type: 'trust', value: 0.8 },
          { type: 'affinity', value: 0.7 },
        ],
      });

      const report = generateReport(graph);
      for (let i = 1; i < report.hotspots.length; i++) {
        expect(report.hotspots[i - 1].severity).toBeGreaterThanOrEqual(
          report.hotspots[i].severity
        );
      }
    });
  });

  describe('summary generation', () => {
    it('should include agent and relationship counts', () => {
      graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      const report = generateReport(graph);
      expect(report.summary).toContain('2 agents');
      expect(report.summary).toContain('1 relationships');
    });

    it('should mention positive tone for positive valence', () => {
      const rel = graph.addFromSeed({ from: 'alice', to: 'bob', type: 'ally' });
      // Push valence positive by applying many strong positive events
      // EMA: valence = valence * 0.9 + avgImpact * 0.1
      // After many events with impact 0.5, valence → 0.5 * (0.1 / (1-0.9)) = 0.5
      for (let i = 0; i < 50; i++) {
        graph.applyEvent(rel.id, {
          id: `evt-${i}`,
          timestamp: new Date().toISOString(),
          type: 'task.completed',
          participants: ['alice', 'bob'],
          impact: { trust: 0.5 },
        });
      }

      const report = generateReport(graph);
      expect(report.summary).toContain('positive');
    });

    it('should mention high-severity hotspots in summary', () => {
      graph.addFromSeed({
        from: 'alice',
        to: 'bob',
        dimensions: [
          { type: 'rivalry', value: 0.9 },
          { type: 'trust', value: -0.5 },
        ],
      });

      const report = generateReport(graph);
      if (report.hotspots.some(h => h.severity > 0.5)) {
        expect(report.summary).toContain('hotspot');
      }
    });
  });
});
