import type { RelationshipTemplate } from '../../schema/types.js';

export const peer: RelationshipTemplate = {
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
};
