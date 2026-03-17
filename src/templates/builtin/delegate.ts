import type { RelationshipTemplate } from '../../schema/types.js';

export const delegate: RelationshipTemplate = {
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
};
