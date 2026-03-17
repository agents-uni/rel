import type { RelationshipTemplate } from '../../schema/types.js';

export const superior: RelationshipTemplate = {
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
};
