/**
 * Template Registry — pre-built relationship patterns.
 *
 * Think of this as "agency-agents for relationships":
 * reusable, well-tested patterns that map common relationship types
 * to multi-dimensional configurations + evolution rules.
 */

import type { RelationshipTemplate } from '../schema/types.js';

const builtinTemplates: Map<string, RelationshipTemplate> = new Map();

// ═══ Legacy compat: agents-uni-core relationship types ═══

builtinTemplates.set('superior', {
  name: 'superior',
  description: 'Hierarchical authority — A outranks B',
  dimensions: [
    { type: 'authority', value: 0.8 },
    { type: 'trust', value: 0.5 },
    { type: 'accountability', value: 0.6 },
  ],
  rules: [
    { on: 'task.completed_well', adjust: { trust: 0.05, accountability: -0.02 }, description: 'Good work builds trust' },
    { on: 'task.failed', adjust: { trust: -0.1, accountability: 0.1 }, description: 'Failure increases oversight' },
    { on: 'conflict.escalated', adjust: { trust: -0.15 }, description: 'Escalation damages trust' },
  ],
});

builtinTemplates.set('subordinate', {
  name: 'subordinate',
  description: 'Reports to — A reports to B',
  dimensions: [
    { type: 'authority', value: -0.8 },
    { type: 'trust', value: 0.5 },
    { type: 'dependence', value: 0.6 },
  ],
  rules: [
    { on: 'task.completed_well', adjust: { trust: 0.05, dependence: -0.03 }, description: 'Competence reduces dependence' },
    { on: 'mentoring.received', adjust: { trust: 0.08, dependence: -0.05 } },
  ],
});

builtinTemplates.set('peer', {
  name: 'peer',
  description: 'Equal-level collaboration',
  dimensions: [
    { type: 'trust', value: 0.5 },
    { type: 'affinity', value: 0.4 },
    { type: 'respect', value: 0.5 },
  ],
  rules: [
    { on: 'collaboration.success', adjust: { trust: 0.06, affinity: 0.04 } },
    { on: 'collaboration.failure', adjust: { trust: -0.04, affinity: -0.02 } },
    { on: 'knowledge.shared', adjust: { respect: 0.05, affinity: 0.03 } },
  ],
});

builtinTemplates.set('competitive', {
  name: 'competitive',
  description: 'Same-level competition for resources or ranking',
  dimensions: [
    { type: 'rivalry', value: 0.5 },
    { type: 'respect', value: 0.3 },
    { type: 'trust', value: 0.2, volatility: 0.5 },
  ],
  rules: [
    { on: 'competition.won', adjust: { rivalry: 0.08, respect: -0.03 } },
    { on: 'competition.lost', adjust: { rivalry: 0.05, respect: 0.05 } },
    { on: 'competition.close_match', adjust: { respect: 0.1 } },
    { on: 'competition.decisive_victory', adjust: { rivalry: 0.15, respect: -0.1 } },
  ],
});

builtinTemplates.set('ally', {
  name: 'ally',
  description: 'Temporary alliance — mutable, can strengthen or break',
  dimensions: [
    { type: 'trust', value: 0.6, volatility: 0.4 },
    { type: 'affinity', value: 0.5, volatility: 0.4 },
    { type: 'loyalty', value: 0.4, volatility: 0.5 },
  ],
  rules: [
    { on: 'alliance.supported', adjust: { trust: 0.08, loyalty: 0.1 } },
    { on: 'alliance.betrayed', adjust: { trust: -0.4, loyalty: -0.5, affinity: -0.3 }, description: 'Betrayal devastates alliance' },
    { on: 'collaboration.success', adjust: { trust: 0.05, affinity: 0.03 } },
  ],
});

builtinTemplates.set('rival', {
  name: 'rival',
  description: 'Persistent competition — deeper than competitive',
  dimensions: [
    { type: 'rivalry', value: 0.7, volatility: 0.3 },
    { type: 'respect', value: 0.4 },
    { type: 'trust', value: -0.2, volatility: 0.4 },
  ],
  rules: [
    { on: 'competition.won', adjust: { rivalry: 0.05, respect: -0.05 } },
    { on: 'competition.lost', adjust: { respect: 0.08 } },
    { on: 'conflict.resolved', adjust: { rivalry: -0.1, trust: 0.1 }, description: 'Resolution de-escalates' },
    { on: 'unexpected_help', adjust: { rivalry: -0.15, trust: 0.2, respect: 0.1 } },
  ],
});

builtinTemplates.set('mentor', {
  name: 'mentor',
  description: 'Knowledge transfer — A teaches B',
  dimensions: [
    { type: 'authority', value: 0.5 },
    { type: 'trust', value: 0.6 },
    { type: 'knowledge_transfer', value: 0.7 },
    { type: 'respect', value: 0.6 },
  ],
  rules: [
    { on: 'teaching.success', adjust: { trust: 0.05, knowledge_transfer: 0.08, respect: 0.03 } },
    { on: 'mentee.surpassed', adjust: { authority: -0.2, respect: 0.15 }, description: 'Student surpasses master' },
    { on: 'teaching.rejected', adjust: { trust: -0.1, knowledge_transfer: -0.1 } },
  ],
});

builtinTemplates.set('advisor', {
  name: 'advisor',
  description: 'Soft influence — A advises B without authority',
  dimensions: [
    { type: 'influence', value: 0.6 },
    { type: 'trust', value: 0.5 },
    { type: 'respect', value: 0.6 },
  ],
  rules: [
    { on: 'advice.followed_success', adjust: { influence: 0.08, trust: 0.05 } },
    { on: 'advice.followed_failure', adjust: { influence: -0.1, trust: -0.08 } },
    { on: 'advice.ignored', adjust: { influence: -0.05 } },
  ],
});

builtinTemplates.set('reviewer', {
  name: 'reviewer',
  description: 'Quality gate — A reviews B\'s work',
  dimensions: [
    { type: 'authority', value: 0.4 },
    { type: 'trust', value: 0.5 },
    { type: 'rigor', value: 0.6 },
  ],
  rules: [
    { on: 'review.approved', adjust: { trust: 0.05 } },
    { on: 'review.rejected_fairly', adjust: { trust: 0.03, rigor: 0.02 } },
    { on: 'review.rejected_unfairly', adjust: { trust: -0.15, rigor: -0.1 } },
  ],
});

builtinTemplates.set('delegate', {
  name: 'delegate',
  description: 'Work delegation — A delegates tasks to B',
  dimensions: [
    { type: 'trust', value: 0.5 },
    { type: 'authority', value: 0.4 },
    { type: 'reliability', value: 0.5 },
  ],
  rules: [
    { on: 'task.delegated_success', adjust: { trust: 0.06, reliability: 0.08 } },
    { on: 'task.delegated_failure', adjust: { trust: -0.1, reliability: -0.15 } },
  ],
});

builtinTemplates.set('serves', {
  name: 'serves',
  description: 'User-centric — A serves the user/ruler',
  dimensions: [
    { type: 'loyalty', value: 0.7 },
    { type: 'trust', value: 0.5 },
    { type: 'devotion', value: 0.5 },
  ],
  rules: [
    { on: 'service.excellent', adjust: { trust: 0.08, devotion: 0.05 } },
    { on: 'service.poor', adjust: { trust: -0.1, devotion: -0.05 } },
    { on: 'user.praised', adjust: { loyalty: 0.05, devotion: 0.08 } },
  ],
});

// ═══ Extended templates ═══

builtinTemplates.set('collaborates', {
  name: 'collaborates',
  description: 'Active collaboration on shared goals',
  dimensions: [
    { type: 'trust', value: 0.5 },
    { type: 'synergy', value: 0.4 },
    { type: 'communication', value: 0.5 },
  ],
  rules: [
    { on: 'collaboration.success', adjust: { trust: 0.06, synergy: 0.08, communication: 0.03 } },
    { on: 'collaboration.failure', adjust: { trust: -0.05, synergy: -0.05 } },
    { on: 'communication.breakthrough', adjust: { communication: 0.15, synergy: 0.1 } },
    { on: 'miscommunication', adjust: { communication: -0.1, trust: -0.03 } },
  ],
});

builtinTemplates.set('supervises', {
  name: 'supervises',
  description: 'Management — alias for superior with management nuance',
  dimensions: [
    { type: 'authority', value: 0.7 },
    { type: 'trust', value: 0.5 },
    { type: 'empowerment', value: 0.4 },
  ],
  rules: [
    { on: 'task.completed_well', adjust: { trust: 0.05, empowerment: 0.06 } },
    { on: 'task.failed', adjust: { trust: -0.08, empowerment: -0.1 } },
    { on: 'autonomy.granted', adjust: { empowerment: 0.1, trust: 0.05 } },
  ],
});

builtinTemplates.set('competes', {
  name: 'competes',
  description: 'Alias for competitive',
  dimensions: builtinTemplates.get('competitive')!.dimensions,
  rules: builtinTemplates.get('competitive')!.rules,
});

builtinTemplates.set('audits', {
  name: 'audits',
  description: 'Audit/oversight relationship',
  dimensions: [
    { type: 'authority', value: 0.5 },
    { type: 'trust', value: 0.4 },
    { type: 'transparency', value: 0.6 },
  ],
  rules: [
    { on: 'audit.clean', adjust: { trust: 0.08, transparency: 0.05 } },
    { on: 'audit.issues_found', adjust: { trust: -0.1, transparency: -0.08 } },
    { on: 'audit.resolved', adjust: { trust: 0.05, transparency: 0.1 } },
  ],
});

builtinTemplates.set('advises', {
  name: 'advises',
  description: 'Alias for advisor',
  dimensions: builtinTemplates.get('advisor')!.dimensions,
  rules: builtinTemplates.get('advisor')!.rules,
});

// ═══ Custom template registry ═══

const customTemplates: Map<string, RelationshipTemplate> = new Map();

/** Register a custom template */
export function registerTemplate(template: RelationshipTemplate): void {
  customTemplates.set(template.name, template);
}

/** Register multiple templates at once */
export function registerTemplates(templates: RelationshipTemplate[]): void {
  for (const t of templates) {
    customTemplates.set(t.name, t);
  }
}

/** Resolve a template by name (custom takes priority over builtin) */
export function resolveTemplate(name: string): RelationshipTemplate | undefined {
  return customTemplates.get(name) ?? builtinTemplates.get(name);
}

/** List all available template names */
export function listTemplates(): string[] {
  const names = new Set<string>();
  for (const k of builtinTemplates.keys()) names.add(k);
  for (const k of customTemplates.keys()) names.add(k);
  return [...names].sort();
}

/** Get all builtin templates */
export function getBuiltinTemplates(): RelationshipTemplate[] {
  return [...builtinTemplates.values()];
}
