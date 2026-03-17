/**
 * Social Network Analyzer — graph-level queries and analysis.
 *
 * Provides social network analysis algorithms for relationship graphs:
 * influence scoring, community detection, centrality measures,
 * and structural analysis.
 */

import type {
  Relationship,
  Dimension,
  ClusterResult,
  RelationshipQueryResult,
} from '../schema/types.js';
import type { RelationshipGraph } from '../graph/relationship-graph.js';

// ═══════════════════════════════════════════════════════
//  Influence & Centrality
// ═══════════════════════════════════════════════════════

export interface InfluenceScore {
  agentId: string;
  /** Overall influence score (0-1) */
  score: number;
  /** Breakdown by component */
  components: {
    /** Based on number of connections */
    degreeCentrality: number;
    /** Based on incoming trust/authority weighted connections */
    weightedInfluence: number;
    /** Bonus for bridging separate groups */
    bridgingBonus: number;
  };
}

/**
 * Compute influence scores for all agents in the graph.
 * Combines degree centrality, weighted influence, and bridging bonus.
 */
export function computeInfluence(
  graph: RelationshipGraph,
  dimensionType = 'trust'
): InfluenceScore[] {
  const agentIds = graph.getAllAgentIds();
  if (agentIds.length === 0) return [];

  const scores: InfluenceScore[] = [];
  const maxDegree = Math.max(1, ...agentIds.map(id => graph.getAll(id).length));
  const clusters = detectClusters(graph, dimensionType, 0);

  for (const agentId of agentIds) {
    const allRels = graph.getAll(agentId);
    const incoming = graph.getIncoming(agentId);

    // Degree centrality: normalized count of connections
    const degreeCentrality = allRels.length / maxDegree;

    // Weighted influence: sum of positive incoming dimension values
    let weightedInfluence = 0;
    for (const rel of incoming) {
      const dim = rel.dimensions.find(d => d.type === dimensionType);
      if (dim && dim.value > 0) {
        weightedInfluence += dim.value * dim.confidence;
      }
    }
    weightedInfluence = Math.min(1, weightedInfluence / Math.max(1, agentIds.length * 0.3));

    // Bridging bonus: agent connects different clusters
    let bridgingBonus = 0;
    if (clusters.clusters.length > 1) {
      const connectedClusters = new Set<string>();
      for (const rel of allRels) {
        const otherId = rel.from === agentId ? rel.to : rel.from;
        const otherCluster = clusters.clusters.find(c => c.members.includes(otherId));
        if (otherCluster) connectedClusters.add(otherCluster.id);
      }
      bridgingBonus = Math.min(1, (connectedClusters.size - 1) / Math.max(1, clusters.clusters.length - 1));
    }

    const score = degreeCentrality * 0.3 + weightedInfluence * 0.5 + bridgingBonus * 0.2;

    scores.push({
      agentId,
      score: Math.min(1, score),
      components: { degreeCentrality, weightedInfluence, bridgingBonus },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════
//  Community Detection (Cluster Analysis)
// ═══════════════════════════════════════════════════════

/**
 * Detect communities/clusters in the relationship graph.
 * Uses connected-component analysis on positive relationships.
 *
 * @param minDimensionValue - Minimum dimension value to consider as a connection
 */
export function detectClusters(
  graph: RelationshipGraph,
  dimensionType = 'trust',
  minDimensionValue = 0.2
): ClusterResult {
  const agentIds = graph.getAllAgentIds();
  const visited = new Set<string>();
  const clusters: ClusterResult['clusters'] = [];
  let clusterId = 0;

  for (const agentId of agentIds) {
    if (visited.has(agentId)) continue;

    // BFS to find connected component
    const members: string[] = [];
    const queue = [agentId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      members.push(current);

      for (const rel of graph.getAll(current)) {
        const otherId = rel.from === current ? rel.to : rel.from;
        if (visited.has(otherId)) continue;

        const dim = rel.dimensions.find(d => d.type === dimensionType);
        if (dim && dim.value >= minDimensionValue) {
          queue.push(otherId);
        }
      }
    }

    if (members.length > 0) {
      // Compute cohesion: average internal dimension value
      let totalValue = 0;
      let edgeCount = 0;

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const rels = graph.getBetween(members[i], members[j]);
          for (const rel of rels) {
            const dim = rel.dimensions.find(d => d.type === dimensionType);
            if (dim) {
              totalValue += dim.value;
              edgeCount++;
            }
          }
        }
      }

      clusters.push({
        id: `cluster-${clusterId++}`,
        members,
        cohesion: edgeCount > 0 ? totalValue / edgeCount : 0,
      });
    }
  }

  return { clusters };
}

// ═══════════════════════════════════════════════════════
//  Structural Analysis
// ═══════════════════════════════════════════════════════

export interface StructuralAnalysis {
  /** Total agents in graph */
  agentCount: number;
  /** Total relationships */
  relationshipCount: number;
  /** Graph density (edges / max possible edges) */
  density: number;
  /** Number of clusters/communities */
  clusterCount: number;
  /** Average connections per agent */
  averageDegree: number;
  /** Most connected agent */
  hub: { agentId: string; degree: number } | null;
  /** Agent with highest incoming trust */
  mostTrusted: { agentId: string; totalTrust: number } | null;
  /** Agent with highest rivalry */
  mostRival: { agentId: string; totalRivalry: number } | null;
  /** Overall graph valence (average relationship valence) */
  graphValence: number;
}

/**
 * Compute structural analysis of the entire graph.
 */
export function analyzeStructure(graph: RelationshipGraph): StructuralAnalysis {
  const agentIds = graph.getAllAgentIds();
  const allRels = graph.getAllRelationships();
  const n = agentIds.length;
  const maxEdges = n * (n - 1); // directed

  // Degree analysis
  let maxDegree = 0;
  let hub: { agentId: string; degree: number } | null = null;
  const degrees = new Map<string, number>();

  for (const agentId of agentIds) {
    const degree = graph.getAll(agentId).length;
    degrees.set(agentId, degree);
    if (degree > maxDegree) {
      maxDegree = degree;
      hub = { agentId, degree };
    }
  }

  // Trust analysis
  let mostTrusted: { agentId: string; totalTrust: number } | null = null;
  let maxTrust = -Infinity;

  for (const agentId of agentIds) {
    let totalTrust = 0;
    for (const rel of graph.getIncoming(agentId)) {
      const dim = rel.dimensions.find(d => d.type === 'trust');
      if (dim) totalTrust += dim.value;
    }
    if (totalTrust > maxTrust) {
      maxTrust = totalTrust;
      mostTrusted = { agentId, totalTrust };
    }
  }

  // Rivalry analysis
  let mostRival: { agentId: string; totalRivalry: number } | null = null;
  let maxRivalry = -Infinity;

  for (const agentId of agentIds) {
    let totalRivalry = 0;
    for (const rel of graph.getAll(agentId)) {
      const dim = rel.dimensions.find(d => d.type === 'rivalry');
      if (dim) totalRivalry += dim.value;
    }
    if (totalRivalry > maxRivalry) {
      maxRivalry = totalRivalry;
      mostRival = { agentId, totalRivalry };
    }
  }

  // Graph valence
  let totalValence = 0;
  for (const rel of allRels) {
    totalValence += rel.memory.valence;
  }

  // Clusters
  const clusters = detectClusters(graph);

  const totalDegree = [...degrees.values()].reduce((s, d) => s + d, 0);

  return {
    agentCount: n,
    relationshipCount: allRels.length,
    density: maxEdges > 0 ? allRels.length / maxEdges : 0,
    clusterCount: clusters.clusters.length,
    averageDegree: n > 0 ? totalDegree / n : 0,
    hub,
    mostTrusted: maxTrust > -Infinity ? mostTrusted : null,
    mostRival: maxRivalry > -Infinity ? mostRival : null,
    graphValence: allRels.length > 0 ? totalValence / allRels.length : 0,
  };
}

// ═══════════════════════════════════════════════════════
//  Relationship Queries
// ═══════════════════════════════════════════════════════

/**
 * Find relationships matching complex filter criteria.
 */
export interface QueryFilter {
  /** Filter by source agent */
  from?: string;
  /** Filter by target agent */
  to?: string;
  /** Filter by tag */
  tag?: string;
  /** Minimum dimension value for a specific dimension */
  minDimension?: { type: string; value: number };
  /** Maximum dimension value for a specific dimension */
  maxDimension?: { type: string; value: number };
  /** Minimum valence */
  minValence?: number;
  /** Minimum interaction count */
  minInteractions?: number;
  /** Relationship origin */
  origin?: 'declared' | 'inferred' | 'emerged';
}

export function queryRelationships(
  graph: RelationshipGraph,
  filter: QueryFilter
): RelationshipQueryResult[] {
  const results: RelationshipQueryResult[] = [];

  for (const rel of graph.getAllRelationships()) {
    // Apply filters
    if (filter.from && rel.from !== filter.from) continue;
    if (filter.to && rel.to !== filter.to) continue;
    if (filter.origin && rel.origin !== filter.origin) continue;
    if (filter.tag && !rel.tags?.includes(filter.tag)) continue;

    if (filter.minValence !== undefined && rel.memory.valence < filter.minValence) continue;

    if (filter.minInteractions !== undefined &&
        rel.memory.longTerm.interactionCount < filter.minInteractions) continue;

    if (filter.minDimension) {
      const dim = rel.dimensions.find(d => d.type === filter.minDimension!.type);
      if (!dim || dim.value < filter.minDimension.value) continue;
    }

    if (filter.maxDimension) {
      const dim = rel.dimensions.find(d => d.type === filter.maxDimension!.type);
      if (!dim || dim.value > filter.maxDimension.value) continue;
    }

    // Compute strength for ranking
    const strength = computeRelationshipStrength(rel);
    results.push({ relationship: rel, strength });
  }

  return results.sort((a, b) => b.strength - a.strength);
}

/**
 * Compute an overall "strength" score for a relationship.
 * Based on dimension magnitudes, confidence, and interaction history.
 */
function computeRelationshipStrength(rel: Relationship): number {
  if (rel.dimensions.length === 0) return 0;

  // Average absolute dimension value, weighted by confidence
  let weightedSum = 0;
  let confidenceSum = 0;
  for (const dim of rel.dimensions) {
    weightedSum += Math.abs(dim.value) * dim.confidence;
    confidenceSum += dim.confidence;
  }
  const dimStrength = confidenceSum > 0 ? weightedSum / confidenceSum : 0;

  // Interaction bonus (more interactions = stronger signal)
  const interactionBonus = Math.min(0.2, rel.memory.longTerm.interactionCount * 0.01);

  return Math.min(1, dimStrength + interactionBonus);
}
