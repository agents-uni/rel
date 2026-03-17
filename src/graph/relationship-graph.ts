/**
 * RelationshipGraph — multi-dimensional directed graph.
 *
 * Each edge (Relationship) carries multiple dimensions, a memory store,
 * and evolves through events. This replaces the simple weighted-edge
 * model from agents-uni-core with a richer, event-sourced structure.
 */

import type {
  Relationship,
  RelationshipSeed,
  RelationshipEvent,
  Dimension,
  DimensionSeed,
  RelationshipMemory,
  PathResult,
} from '../schema/types.js';
import { resolveTemplate } from '../templates/registry.js';

let nextId = 0;
function generateId(): string {
  return `rel-${Date.now()}-${nextId++}`;
}

function generateEventId(): string {
  return `evt-${Date.now()}-${nextId++}`;
}

function seedToDimension(seed: DimensionSeed): Dimension {
  return {
    type: seed.type,
    value: Math.max(-1, Math.min(1, seed.value)),
    confidence: seed.confidence ?? 0.5,
    volatility: seed.volatility ?? 0.3,
    source: 'declared',
  };
}

function createEmptyMemory(): RelationshipMemory {
  return {
    shortTerm: [],
    longTerm: {
      summary: '',
      patterns: [],
      keyMoments: [],
      interactionCount: 0,
    },
    valence: 0,
  };
}

export interface GraphOptions {
  /** Maximum short-term events per relationship */
  maxShortTerm?: number;
  /** Maximum key moments per relationship */
  maxKeyMoments?: number;
}

export class RelationshipGraph {
  private relationships: Map<string, Relationship> = new Map();
  /** Outgoing index: agentId → Set<relationshipId> */
  private outgoing: Map<string, Set<string>> = new Map();
  /** Incoming index: agentId → Set<relationshipId> */
  private incoming: Map<string, Set<string>> = new Map();

  private maxShortTerm: number;
  private maxKeyMoments: number;

  constructor(seeds: RelationshipSeed[] = [], options?: GraphOptions) {
    this.maxShortTerm = options?.maxShortTerm ?? 50;
    this.maxKeyMoments = options?.maxKeyMoments ?? 5;

    for (const seed of seeds) {
      this.addFromSeed(seed);
    }
  }

  // ─── Seed / Create ────────────────────────────────

  /** Create a relationship from a seed declaration */
  addFromSeed(seed: RelationshipSeed): Relationship {
    let dimensions: Dimension[];

    if (seed.dimensions && seed.dimensions.length > 0) {
      // Explicit dimensions
      dimensions = seed.dimensions.map(seedToDimension);
    } else if (seed.type) {
      // Resolve from template
      const template = resolveTemplate(seed.type);
      if (template) {
        dimensions = template.dimensions.map(seedToDimension);
      } else {
        // Unknown type → single generic dimension
        dimensions = [{
          type: seed.type,
          value: seed.weight ?? 0.5,
          confidence: 0.5,
          volatility: 0.3,
          source: 'declared',
        }];
      }
    } else {
      // No type, no dimensions → generic
      dimensions = [{
        type: 'affinity',
        value: seed.weight ?? 0.5,
        confidence: 0.3,
        volatility: 0.3,
        source: 'declared',
      }];
    }

    // Store template name as a tag so the evolution engine can find rules
    const tags = seed.tags ? [...seed.tags] : [];
    if (seed.type && !tags.includes(seed.type)) {
      tags.push(seed.type);
    }

    const now = new Date().toISOString();
    const rel: Relationship = {
      id: generateId(),
      from: seed.from,
      to: seed.to,
      dimensions,
      memory: createEmptyMemory(),
      origin: 'declared',
      createdAt: now,
      updatedAt: now,
      tags: tags.length > 0 ? tags : undefined,
    };

    this.insertRelationship(rel);
    return rel;
  }

  /** Insert a fully-formed relationship */
  private insertRelationship(rel: Relationship): void {
    this.relationships.set(rel.id, rel);

    if (!this.outgoing.has(rel.from)) this.outgoing.set(rel.from, new Set());
    this.outgoing.get(rel.from)!.add(rel.id);

    if (!this.incoming.has(rel.to)) this.incoming.set(rel.to, new Set());
    this.incoming.get(rel.to)!.add(rel.id);
  }

  // ─── Query ────────────────────────────────────────

  /** Get a relationship by ID */
  get(id: string): Relationship | undefined {
    return this.relationships.get(id);
  }

  /** Get all outgoing relationships from an agent */
  getOutgoing(agentId: string): Relationship[] {
    const ids = this.outgoing.get(agentId);
    if (!ids) return [];
    return [...ids].map(id => this.relationships.get(id)!);
  }

  /** Get all incoming relationships to an agent */
  getIncoming(agentId: string): Relationship[] {
    const ids = this.incoming.get(agentId);
    if (!ids) return [];
    return [...ids].map(id => this.relationships.get(id)!);
  }

  /** Get all relationships for an agent (both directions) */
  getAll(agentId: string): Relationship[] {
    return [...this.getOutgoing(agentId), ...this.getIncoming(agentId)];
  }

  /** Get direct relationships between two agents (both directions) */
  getBetween(fromId: string, toId: string): Relationship[] {
    return [
      ...this.getOutgoing(fromId).filter(r => r.to === toId),
      ...this.getOutgoing(toId).filter(r => r.to === fromId),
    ];
  }

  /** Get agents connected by a specific dimension type */
  getByDimension(agentId: string, dimensionType: string, minValue?: number): Array<{ agentId: string; relationship: Relationship; dimension: Dimension }> {
    const results: Array<{ agentId: string; relationship: Relationship; dimension: Dimension }> = [];
    const threshold = minValue ?? -Infinity;

    for (const rel of this.getAll(agentId)) {
      const dim = rel.dimensions.find(d => d.type === dimensionType);
      if (dim && dim.value >= threshold) {
        const otherId = rel.from === agentId ? rel.to : rel.from;
        results.push({ agentId: otherId, relationship: rel, dimension: dim });
      }
    }

    return results.sort((a, b) => b.dimension.value - a.dimension.value);
  }

  /** Get the primary dimension value between two agents */
  getDimensionValue(fromId: string, toId: string, dimensionType: string): number | undefined {
    const rels = this.getOutgoing(fromId).filter(r => r.to === toId);
    for (const rel of rels) {
      const dim = rel.dimensions.find(d => d.type === dimensionType);
      if (dim) return dim.value;
    }
    return undefined;
  }

  /** Get all unique agent IDs in the graph */
  getAllAgentIds(): string[] {
    const ids = new Set<string>();
    for (const [from] of this.outgoing) ids.add(from);
    for (const [to] of this.incoming) ids.add(to);
    return [...ids];
  }

  /** Get all relationships in the graph */
  getAllRelationships(): Relationship[] {
    return [...this.relationships.values()];
  }

  /** Get relationship count */
  get size(): number {
    return this.relationships.size;
  }

  // ─── Event Processing ─────────────────────────────

  /**
   * Apply an event to a relationship.
   * This is the core mutation method — all state changes go through events.
   */
  applyEvent(relationshipId: string, event: RelationshipEvent): boolean {
    const rel = this.relationships.get(relationshipId);
    if (!rel) return false;

    // Apply impact to dimensions
    for (const [dimType, delta] of Object.entries(event.impact)) {
      const dim = rel.dimensions.find(d => d.type === dimType);
      if (dim) {
        dim.value = Math.max(-1, Math.min(1, dim.value + delta));
        dim.confidence = Math.min(1, dim.confidence + 0.02);
        dim.source = 'evolved';
      } else {
        // New dimension emerged from event
        rel.dimensions.push({
          type: dimType,
          value: Math.max(-1, Math.min(1, delta)),
          confidence: 0.2,
          volatility: 0.5,
          source: 'evolved',
        });
      }
    }

    // Update memory
    rel.memory.shortTerm.push(event);
    if (rel.memory.shortTerm.length > this.maxShortTerm) {
      rel.memory.shortTerm.shift();
    }
    rel.memory.longTerm.interactionCount++;

    // Update valence (exponential moving average of event impact)
    const totalImpact = Object.values(event.impact).reduce((s, v) => s + v, 0);
    const avgImpact = Object.keys(event.impact).length > 0
      ? totalImpact / Object.keys(event.impact).length
      : 0;
    rel.memory.valence = rel.memory.valence * 0.9 + avgImpact * 0.1;
    rel.memory.valence = Math.max(-1, Math.min(1, rel.memory.valence));

    rel.updatedAt = event.timestamp;

    return true;
  }

  /**
   * Apply an event between two agents (convenience method).
   * Finds or creates the relationship, then applies the event.
   */
  applyEventBetween(fromId: string, toId: string, event: Omit<RelationshipEvent, 'id' | 'timestamp' | 'participants'>): Relationship {
    let rels = this.getOutgoing(fromId).filter(r => r.to === toId);

    // If no relationship exists, create an emerged one
    if (rels.length === 0) {
      const now = new Date().toISOString();
      const rel: Relationship = {
        id: generateId(),
        from: fromId,
        to: toId,
        dimensions: [],
        memory: createEmptyMemory(),
        origin: 'emerged',
        createdAt: now,
        updatedAt: now,
      };
      this.insertRelationship(rel);
      rels = [rel];
    }

    const fullEvent: RelationshipEvent = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      participants: [fromId, toId],
      ...event,
    };

    this.applyEvent(rels[0].id, fullEvent);
    return rels[0];
  }

  // ─── Graph Algorithms ─────────────────────────────

  /**
   * Find shortest path between two agents (BFS).
   * Uses inverse of trust/affinity dimension as edge cost.
   */
  findPath(fromId: string, toId: string, dimensionType = 'trust'): PathResult | null {
    if (fromId === toId) return { path: [fromId], cost: 0, relationships: [] };

    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[]; cost: number; rels: Relationship[] }> = [
      { node: fromId, path: [fromId], cost: 0, rels: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.node)) continue;
      visited.add(current.node);

      for (const rel of this.getOutgoing(current.node)) {
        if (rel.to === toId) {
          const dim = rel.dimensions.find(d => d.type === dimensionType);
          const edgeCost = dim ? 1 - Math.max(0, dim.value) : 1;
          return {
            path: [...current.path, toId],
            cost: current.cost + edgeCost,
            relationships: [...current.rels, rel],
          };
        }
        if (!visited.has(rel.to)) {
          const dim = rel.dimensions.find(d => d.type === dimensionType);
          const edgeCost = dim ? 1 - Math.max(0, dim.value) : 1;
          queue.push({
            node: rel.to,
            path: [...current.path, rel.to],
            cost: current.cost + edgeCost,
            rels: [...current.rels, rel],
          });
        }
      }
    }

    return null;
  }

  /**
   * Find the N most trusted/strongest connections for an agent.
   */
  getStrongestConnections(agentId: string, dimensionType = 'trust', limit = 5): Array<{ agentId: string; value: number; relationship: Relationship }> {
    return this.getByDimension(agentId, dimensionType)
      .slice(0, limit)
      .map(r => ({ agentId: r.agentId, value: r.dimension.value, relationship: r.relationship }));
  }

  // ─── Decay ────────────────────────────────────────

  /**
   * Apply time-based decay to all relationships.
   * Relationships that haven't been active decay toward neutral.
   */
  applyDecay(decayRate = 0.01): number {
    let decayed = 0;
    const now = new Date();

    for (const rel of this.relationships.values()) {
      const lastUpdate = new Date(rel.updatedAt);
      const daysSince = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 1) continue; // Only decay after 1 day of inactivity

      for (const dim of rel.dimensions) {
        const actualDecay = decayRate * dim.volatility * daysSince;
        if (dim.value > 0) {
          dim.value = Math.max(0, dim.value - actualDecay);
        } else if (dim.value < 0) {
          dim.value = Math.min(0, dim.value + actualDecay);
        }
        // Confidence also decays (we become less sure about stale data)
        dim.confidence = Math.max(0.1, dim.confidence - actualDecay * 0.5);
      }

      // Valence decays toward 0
      rel.memory.valence *= (1 - decayRate * daysSince * 0.1);

      decayed++;
    }

    return decayed;
  }

  // ─── Serialization ────────────────────────────────

  /** Export the full graph state (for persistence) */
  toJSON(): { relationships: Relationship[] } {
    return { relationships: [...this.relationships.values()] };
  }

  /** Restore graph from serialized state */
  static fromJSON(data: { relationships: Relationship[] }, options?: GraphOptions): RelationshipGraph {
    const graph = new RelationshipGraph([], options);
    for (const rel of data.relationships) {
      graph.insertRelationship(rel);
    }
    return graph;
  }

  /** Export as simple adjacency list (for visualization / legacy compat) */
  toAdjacencyList(): Record<string, Array<{ to: string; dimensions: Record<string, number>; valence: number }>> {
    const result: Record<string, Array<{ to: string; dimensions: Record<string, number>; valence: number }>> = {};

    for (const [from, relIds] of this.outgoing) {
      result[from] = [...relIds].map(id => {
        const rel = this.relationships.get(id)!;
        const dims: Record<string, number> = {};
        for (const d of rel.dimensions) {
          dims[d.type] = d.value;
        }
        return { to: rel.to, dimensions: dims, valence: rel.memory.valence };
      });
    }

    return result;
  }
}
