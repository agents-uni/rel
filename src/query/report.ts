/**
 * Report generator — structured relationship analysis reports.
 *
 * Pure rule-based, no LLM dependency. Produces human-readable summaries
 * and actionable hotspot detection for relationship graphs.
 */

import type { RelationshipGraph } from '../graph/relationship-graph.js';
import type { InfluenceScore, StructuralAnalysis } from './analyzer.js';
import { computeInfluence, detectClusters, analyzeStructure } from './analyzer.js';

// ═══════════════════════════════════════════════════════
//  Report Types
// ═══════════════════════════════════════════════════════

export interface RelationshipHotspot {
  /** Hotspot type identifier */
  type: 'conflict_risk' | 'power_imbalance' | 'isolated_agent' | 'strong_alliance' | 'rivalry_cluster';
  /** Severity: 0-1 */
  severity: number;
  /** Agents involved */
  agents: string[];
  /** Human-readable description */
  description: string;
}

export interface RelationshipReport {
  /** One-line summary of graph state */
  summary: string;
  /** Structural analysis */
  structure: StructuralAnalysis;
  /** Influence ranking (all agents) */
  influenceRanking: InfluenceScore[];
  /** Detected clusters with cohesion */
  clusters: Array<{
    id: string;
    members: string[];
    cohesion: number;
  }>;
  /** Actionable hotspots (conflict risks, imbalances, etc.) */
  hotspots: RelationshipHotspot[];
  /** ISO timestamp */
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════
//  Report Generation
// ═══════════════════════════════════════════════════════

/**
 * Generate a comprehensive relationship report for a graph.
 * Combines structural analysis, influence scoring, cluster detection,
 * and rule-based hotspot identification.
 */
export function generateReport(graph: RelationshipGraph): RelationshipReport {
  const structure = analyzeStructure(graph);
  const influenceRanking = computeInfluence(graph);
  const clusterResult = detectClusters(graph);
  const hotspots = detectHotspots(graph, structure, influenceRanking);

  const summary = buildSummary(structure, hotspots);

  return {
    summary,
    structure,
    influenceRanking,
    clusters: clusterResult.clusters,
    hotspots,
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════
//  Hotspot Detection (Rule-Based)
// ═══════════════════════════════════════════════════════

function detectHotspots(
  graph: RelationshipGraph,
  structure: StructuralAnalysis,
  influenceRanking: InfluenceScore[]
): RelationshipHotspot[] {
  const hotspots: RelationshipHotspot[] = [];

  detectConflictRisks(graph, hotspots);
  detectPowerImbalances(influenceRanking, hotspots);
  detectIsolatedAgents(graph, hotspots);
  detectStrongAlliances(graph, hotspots);
  detectRivalryClusters(graph, hotspots);

  return hotspots.sort((a, b) => b.severity - a.severity);
}

/**
 * Conflict risk: high rivalry + low trust between a pair.
 */
function detectConflictRisks(graph: RelationshipGraph, hotspots: RelationshipHotspot[]): void {
  for (const rel of graph.getAllRelationships()) {
    const rivalry = rel.dimensions.find(d => d.type === 'rivalry');
    const trust = rel.dimensions.find(d => d.type === 'trust');

    if (rivalry && trust && rivalry.value > 0.3 && trust.value < 0.2) {
      const severity = Math.min(1, (rivalry.value - trust.value) / 2);
      hotspots.push({
        type: 'conflict_risk',
        severity,
        agents: [rel.from, rel.to],
        description: `High rivalry (${rivalry.value.toFixed(2)}) with low trust (${trust.value.toFixed(2)}) between ${rel.from} and ${rel.to}`,
      });
    }
  }
}

/**
 * Power imbalance: one agent has significantly higher influence than others.
 */
function detectPowerImbalances(influenceRanking: InfluenceScore[], hotspots: RelationshipHotspot[]): void {
  if (influenceRanking.length < 2) return;

  const top = influenceRanking[0];
  const second = influenceRanking[1];
  const gap = top.score - second.score;

  if (gap > 0.3 && top.score > 0.5) {
    hotspots.push({
      type: 'power_imbalance',
      severity: Math.min(1, gap),
      agents: [top.agentId],
      description: `${top.agentId} has significantly higher influence (${top.score.toFixed(2)}) than others (next: ${second.score.toFixed(2)})`,
    });
  }
}

/**
 * Isolated agent: zero or very few connections.
 */
function detectIsolatedAgents(graph: RelationshipGraph, hotspots: RelationshipHotspot[]): void {
  const agentIds = graph.getAllAgentIds();
  if (agentIds.length <= 2) return;

  for (const agentId of agentIds) {
    const connections = graph.getAll(agentId);
    if (connections.length === 0) {
      hotspots.push({
        type: 'isolated_agent',
        severity: 0.8,
        agents: [agentId],
        description: `${agentId} has no relationships — completely isolated`,
      });
    } else if (connections.length === 1 && agentIds.length > 3) {
      hotspots.push({
        type: 'isolated_agent',
        severity: 0.4,
        agents: [agentId],
        description: `${agentId} has only 1 connection in a graph of ${agentIds.length} agents`,
      });
    }
  }
}

/**
 * Strong alliance: two agents with high trust + high affinity.
 */
function detectStrongAlliances(graph: RelationshipGraph, hotspots: RelationshipHotspot[]): void {
  for (const rel of graph.getAllRelationships()) {
    const trust = rel.dimensions.find(d => d.type === 'trust');
    const affinity = rel.dimensions.find(d => d.type === 'affinity');

    if (trust && affinity && trust.value > 0.6 && affinity.value > 0.5) {
      hotspots.push({
        type: 'strong_alliance',
        severity: Math.min(1, (trust.value + affinity.value) / 2),
        agents: [rel.from, rel.to],
        description: `Strong alliance between ${rel.from} and ${rel.to} (trust: ${trust.value.toFixed(2)}, affinity: ${affinity.value.toFixed(2)})`,
      });
    }
  }
}

/**
 * Rivalry cluster: multiple agents with mutual high rivalry form a tension zone.
 */
function detectRivalryClusters(graph: RelationshipGraph, hotspots: RelationshipHotspot[]): void {
  const agentIds = graph.getAllAgentIds();
  const rivalPairs: Array<[string, string]> = [];

  for (const rel of graph.getAllRelationships()) {
    const rivalry = rel.dimensions.find(d => d.type === 'rivalry');
    if (rivalry && rivalry.value > 0.3) {
      rivalPairs.push([rel.from, rel.to]);
    }
  }

  // Find agents involved in 2+ rival relationships
  const rivalCounts = new Map<string, number>();
  for (const [a, b] of rivalPairs) {
    rivalCounts.set(a, (rivalCounts.get(a) ?? 0) + 1);
    rivalCounts.set(b, (rivalCounts.get(b) ?? 0) + 1);
  }

  const clusterMembers = [...rivalCounts.entries()]
    .filter(([_, count]) => count >= 2)
    .map(([agentId]) => agentId);

  if (clusterMembers.length >= 2) {
    hotspots.push({
      type: 'rivalry_cluster',
      severity: Math.min(1, clusterMembers.length / agentIds.length),
      agents: clusterMembers,
      description: `Rivalry cluster involving ${clusterMembers.join(', ')} — multiple overlapping rivalries`,
    });
  }
}

// ═══════════════════════════════════════════════════════
//  Summary Generation
// ═══════════════════════════════════════════════════════

function buildSummary(structure: StructuralAnalysis, hotspots: RelationshipHotspot[]): string {
  const parts: string[] = [];

  parts.push(`${structure.agentCount} agents, ${structure.relationshipCount} relationships`);

  if (structure.clusterCount > 1) {
    parts.push(`${structure.clusterCount} clusters`);
  }

  if (structure.graphValence > 0.2) {
    parts.push('overall positive tone');
  } else if (structure.graphValence < -0.2) {
    parts.push('overall negative tone');
  } else {
    parts.push('neutral tone');
  }

  const criticalHotspots = hotspots.filter(h => h.severity > 0.5);
  if (criticalHotspots.length > 0) {
    parts.push(`${criticalHotspots.length} high-severity hotspot(s)`);
  }

  return parts.join(', ');
}
