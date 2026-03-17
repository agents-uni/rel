/**
 * Emergence Detector — auto-detects new relationships from event patterns.
 *
 * When agents interact repeatedly without a declared relationship,
 * the detector can infer the nature of their connection and
 * create emerged relationships in the graph.
 *
 * This is the "emergent behavior" layer — relationships that arise
 * from repeated interactions rather than being declared upfront.
 */

import type { RelationshipEvent, DimensionSeed } from '../schema/types.js';
import type { RelationshipGraph } from '../graph/relationship-graph.js';

// ═══════════════════════════════════════════════════════
//  Emergence patterns
// ═══════════════════════════════════════════════════════

export interface EmergenceRule {
  /** Rule identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Minimum events between two agents to trigger */
  minEvents: number;
  /** Event types that count toward this pattern */
  eventPatterns: string[];
  /** How to detect this pattern from event history */
  detect: (events: RelationshipEvent[]) => boolean;
  /** What dimensions to seed when creating the emerged relationship */
  dimensions: DimensionSeed[];
  /** Tags for the emerged relationship */
  tags?: string[];
}

/** Built-in emergence rules */
const builtinRules: EmergenceRule[] = [
  {
    name: 'frequent-collaboration',
    description: 'Agents that collaborate frequently develop a peer bond',
    minEvents: 3,
    eventPatterns: ['collaboration.*', 'task.completed', 'task.collaborated'],
    detect: (events) => {
      const collabEvents = events.filter(e =>
        e.type.includes('collaborat') || e.type.includes('task.completed')
      );
      return collabEvents.length >= 3;
    },
    dimensions: [
      { type: 'trust', value: 0.4, confidence: 0.3 },
      { type: 'synergy', value: 0.3, confidence: 0.3 },
    ],
    tags: ['emerged', 'collaboration-based'],
  },
  {
    name: 'repeated-competition',
    description: 'Agents that compete repeatedly develop a rivalry',
    minEvents: 3,
    eventPatterns: ['competition.*', 'contest.*'],
    detect: (events) => {
      const compEvents = events.filter(e =>
        e.type.includes('competition') || e.type.includes('contest')
      );
      return compEvents.length >= 3;
    },
    dimensions: [
      { type: 'rivalry', value: 0.4, confidence: 0.3 },
      { type: 'respect', value: 0.2, confidence: 0.2 },
    ],
    tags: ['emerged', 'competition-based'],
  },
  {
    name: 'escalating-conflict',
    description: 'Repeated conflicts create an antagonistic relationship',
    minEvents: 2,
    eventPatterns: ['conflict.*', 'dispute.*', 'alliance.betrayed'],
    detect: (events) => {
      const conflictEvents = events.filter(e =>
        e.type.includes('conflict') || e.type.includes('dispute') || e.type.includes('betray')
      );
      return conflictEvents.length >= 2;
    },
    dimensions: [
      { type: 'trust', value: -0.3, confidence: 0.4 },
      { type: 'rivalry', value: 0.5, confidence: 0.3 },
    ],
    tags: ['emerged', 'conflict-based'],
  },
  {
    name: 'knowledge-sharing',
    description: 'One agent repeatedly teaches/mentors another',
    minEvents: 3,
    eventPatterns: ['teaching.*', 'mentoring.*', 'knowledge.*'],
    detect: (events) => {
      const teachEvents = events.filter(e =>
        e.type.includes('teach') || e.type.includes('mentor') || e.type.includes('knowledge')
      );
      return teachEvents.length >= 3;
    },
    dimensions: [
      { type: 'knowledge_transfer', value: 0.5, confidence: 0.3 },
      { type: 'trust', value: 0.3, confidence: 0.2 },
      { type: 'respect', value: 0.4, confidence: 0.3 },
    ],
    tags: ['emerged', 'mentoring-based'],
  },
  {
    name: 'mutual-support',
    description: 'Agents that support each other develop an alliance',
    minEvents: 3,
    eventPatterns: ['alliance.*', 'support.*', 'help.*'],
    detect: (events) => {
      const supportEvents = events.filter(e =>
        e.type.includes('alliance') || e.type.includes('support') || e.type.includes('help')
      );
      return supportEvents.length >= 3;
    },
    dimensions: [
      { type: 'trust', value: 0.5, confidence: 0.3 },
      { type: 'loyalty', value: 0.4, confidence: 0.3 },
      { type: 'affinity', value: 0.4, confidence: 0.3 },
    ],
    tags: ['emerged', 'alliance-based'],
  },
];

// ═══════════════════════════════════════════════════════
//  Emergence Detector
// ═══════════════════════════════════════════════════════

export interface EmergenceResult {
  from: string;
  to: string;
  rule: string;
  description: string;
  dimensions: DimensionSeed[];
  created: boolean;
}

export interface EmergenceDetectorOptions {
  /** Custom emergence rules (added to builtin) */
  customRules?: EmergenceRule[];
  /** Whether to include builtin rules (default: true) */
  includeBuiltin?: boolean;
  /** Whether to auto-create relationships (default: true) */
  autoCreate?: boolean;
}

export class EmergenceDetector {
  private rules: EmergenceRule[];
  private autoCreate: boolean;
  /** Event buffer: "from:to" → events */
  private eventBuffer: Map<string, RelationshipEvent[]> = new Map();

  constructor(
    private graph: RelationshipGraph,
    options?: EmergenceDetectorOptions
  ) {
    const includeBuiltin = options?.includeBuiltin ?? true;
    this.rules = includeBuiltin ? [...builtinRules] : [];
    if (options?.customRules) {
      this.rules.push(...options.customRules);
    }
    this.autoCreate = options?.autoCreate ?? true;
  }

  /** Add a custom emergence rule */
  addRule(rule: EmergenceRule): void {
    this.rules.push(rule);
  }

  /**
   * Buffer an event for emergence detection.
   * Call this for events between agents that don't have a declared relationship.
   */
  observe(event: RelationshipEvent): void {
    if (event.participants.length < 2) return;

    // Buffer for all participant pairs
    for (let i = 0; i < event.participants.length; i++) {
      for (let j = i + 1; j < event.participants.length; j++) {
        const key = pairKey(event.participants[i], event.participants[j]);
        if (!this.eventBuffer.has(key)) {
          this.eventBuffer.set(key, []);
        }
        this.eventBuffer.get(key)!.push(event);
      }
    }
  }

  /**
   * Check all buffered events for emergence patterns.
   * Creates new relationships when patterns are detected.
   */
  detect(): EmergenceResult[] {
    const results: EmergenceResult[] = [];

    for (const [key, events] of this.eventBuffer) {
      const [from, to] = key.split(':');

      // Skip if relationship already exists
      const existing = this.graph.getBetween(from, to);
      if (existing.length > 0) continue;

      // Check each rule
      for (const rule of this.rules) {
        if (events.length < rule.minEvents) continue;

        if (rule.detect(events)) {
          const result: EmergenceResult = {
            from,
            to,
            rule: rule.name,
            description: rule.description,
            dimensions: rule.dimensions,
            created: false,
          };

          if (this.autoCreate) {
            this.graph.addFromSeed({
              from,
              to,
              dimensions: rule.dimensions,
              tags: rule.tags,
            });
            result.created = true;
          }

          results.push(result);
          break; // Only one emergence per pair
        }
      }
    }

    // Clear processed events for emerged relationships
    for (const result of results) {
      if (result.created) {
        this.eventBuffer.delete(pairKey(result.from, result.to));
      }
    }

    return results;
  }

  /**
   * Process an event end-to-end:
   * 1. If relationship exists → apply through graph
   * 2. If no relationship → buffer for emergence detection
   * 3. Check emergence patterns
   */
  processEvent(event: RelationshipEvent): EmergenceResult[] {
    if (event.participants.length < 2) return [];

    // For each participant pair
    for (let i = 0; i < event.participants.length; i++) {
      for (let j = i + 1; j < event.participants.length; j++) {
        const from = event.participants[i];
        const to = event.participants[j];
        const existing = this.graph.getBetween(from, to);

        if (existing.length > 0) {
          // Apply to existing relationship
          for (const rel of existing) {
            this.graph.applyEvent(rel.id, event);
          }
        } else {
          // Buffer for emergence
          this.observe(event);
        }
      }
    }

    return this.detect();
  }

  /** Get current buffer stats */
  getBufferStats(): Array<{ pair: string; eventCount: number }> {
    return [...this.eventBuffer.entries()].map(([pair, events]) => ({
      pair,
      eventCount: events.length,
    }));
  }

  /** Clear the event buffer */
  clearBuffer(): void {
    this.eventBuffer.clear();
  }
}

function pairKey(from: string, to: string): string {
  // Canonical key — alphabetical order so (a,b) == (b,a)
  return [from, to].sort().join(':');
}
