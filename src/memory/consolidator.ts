/**
 * Memory Consolidator — compresses short-term events into long-term patterns.
 *
 * This is the bridge between raw events and meaningful relationship memory.
 * Modeled after human memory consolidation:
 *   short-term (recent, detailed) → long-term (compressed, pattern-based)
 */

import type { Relationship, RelationshipEvent, Pattern } from '../schema/types.js';
import type { RelationshipGraph } from '../graph/relationship-graph.js';

export interface ConsolidationResult {
  relationshipId: string;
  patternsDetected: Pattern[];
  keyMomentsUpdated: boolean;
  summaryUpdated: boolean;
}

export interface ConsolidationOptions {
  /** Minimum events before consolidation triggers */
  minEvents?: number;
  /** Maximum key moments to keep */
  maxKeyMoments?: number;
  /** Custom summary generator (e.g., LLM-powered) */
  summaryGenerator?: (rel: Relationship) => string;
}

/** Detect patterns from a list of events */
function detectPatterns(events: RelationshipEvent[]): Pattern[] {
  if (events.length < 3) return [];

  const patterns: Pattern[] = [];
  const typeCounts: Map<string, number> = new Map();
  const now = new Date().toISOString();

  // Count event types
  for (const evt of events) {
    typeCounts.set(evt.type, (typeCounts.get(evt.type) ?? 0) + 1);
  }

  const total = events.length;

  // Detect frequent event patterns
  for (const [type, count] of typeCounts) {
    const frequency = count / total;
    if (frequency >= 0.2 && count >= 2) {
      const category = type.split('.')[0];
      const lastEvent = events.filter(e => e.type === type).pop();

      let description: string;
      if (type.includes('success') || type.includes('won')) {
        description = `Frequent positive outcome: ${type} (${count} times)`;
      } else if (type.includes('failure') || type.includes('lost') || type.includes('conflict')) {
        description = `Recurring tension: ${type} (${count} times)`;
      } else {
        description = `Repeated interaction: ${type} (${count} times)`;
      }

      patterns.push({
        type: `frequent_${category}`,
        frequency,
        lastSeen: lastEvent?.timestamp ?? now,
        description,
      });
    }
  }

  // Detect trend patterns (improving vs declining)
  const recentImpacts = events.slice(-10).map(e => {
    const values = Object.values(e.impact);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  });

  if (recentImpacts.length >= 5) {
    const firstHalf = recentImpacts.slice(0, Math.floor(recentImpacts.length / 2));
    const secondHalf = recentImpacts.slice(Math.floor(recentImpacts.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg - firstAvg > 0.05) {
      patterns.push({
        type: 'improving_trend',
        frequency: 1,
        lastSeen: now,
        description: 'Relationship is trending positive',
      });
    } else if (firstAvg - secondAvg > 0.05) {
      patterns.push({
        type: 'declining_trend',
        frequency: 1,
        lastSeen: now,
        description: 'Relationship is trending negative',
      });
    }
  }

  return patterns;
}

/** Select the most impactful events as key moments */
function selectKeyMoments(events: RelationshipEvent[], maxKeyMoments: number): RelationshipEvent[] {
  if (events.length <= maxKeyMoments) return [...events];

  // Score events by total absolute impact
  const scored = events.map(evt => {
    const totalImpact = Object.values(evt.impact)
      .reduce((sum, v) => sum + Math.abs(v), 0);
    return { event: evt, score: totalImpact };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxKeyMoments).map(s => s.event);
}

/** Generate a simple text summary from relationship state */
function generateDefaultSummary(rel: Relationship): string {
  const parts: string[] = [];

  const primaryDims = [...rel.dimensions]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3);

  for (const dim of primaryDims) {
    const strength = Math.abs(dim.value);
    const qualifier = strength > 0.7 ? 'strong' : strength > 0.4 ? 'moderate' : 'weak';
    const direction = dim.value >= 0 ? 'positive' : 'negative';
    parts.push(`${qualifier} ${direction} ${dim.type} (${dim.value.toFixed(2)})`);
  }

  const count = rel.memory.longTerm.interactionCount;
  const countDesc = count > 20 ? 'extensive' : count > 5 ? 'moderate' : 'limited';

  return `${rel.from} → ${rel.to}: ${parts.join(', ')}. ${countDesc} interaction history (${count} events).`;
}

export class MemoryConsolidator {
  private minEvents: number;
  private maxKeyMoments: number;
  private summaryGenerator: (rel: Relationship) => string;

  constructor(options?: ConsolidationOptions) {
    this.minEvents = options?.minEvents ?? 5;
    this.maxKeyMoments = options?.maxKeyMoments ?? 5;
    this.summaryGenerator = options?.summaryGenerator ?? generateDefaultSummary;
  }

  /**
   * Consolidate memory for a single relationship.
   * Moves patterns from short-term events into long-term memory.
   */
  consolidate(rel: Relationship): ConsolidationResult {
    const result: ConsolidationResult = {
      relationshipId: rel.id,
      patternsDetected: [],
      keyMomentsUpdated: false,
      summaryUpdated: false,
    };

    const events = rel.memory.shortTerm;
    if (events.length < this.minEvents) return result;

    // Detect patterns
    const allEvents = [...rel.memory.longTerm.keyMoments, ...events];
    const patterns = detectPatterns(allEvents);
    if (patterns.length > 0) {
      rel.memory.longTerm.patterns = patterns;
      result.patternsDetected = patterns;
    }

    // Update key moments
    const newKeyMoments = selectKeyMoments(allEvents, this.maxKeyMoments);
    const keyMomentsChanged = newKeyMoments.length !== rel.memory.longTerm.keyMoments.length
      || newKeyMoments.some((m, i) => m.id !== rel.memory.longTerm.keyMoments[i]?.id);

    if (keyMomentsChanged) {
      rel.memory.longTerm.keyMoments = newKeyMoments;
      result.keyMomentsUpdated = true;
    }

    // Update summary
    const newSummary = this.summaryGenerator(rel);
    if (newSummary !== rel.memory.longTerm.summary) {
      rel.memory.longTerm.summary = newSummary;
      result.summaryUpdated = true;
    }

    return result;
  }

  /**
   * Consolidate memory for all relationships in a graph.
   */
  consolidateAll(graph: RelationshipGraph): ConsolidationResult[] {
    const results: ConsolidationResult[] = [];

    for (const rel of graph.getAllRelationships()) {
      const result = this.consolidate(rel);
      if (result.patternsDetected.length > 0 || result.keyMomentsUpdated || result.summaryUpdated) {
        results.push(result);
      }
    }

    return results;
  }
}
