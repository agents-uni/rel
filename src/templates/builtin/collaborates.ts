import type { RelationshipTemplate } from '../../schema/types.js';

export const collaborates: RelationshipTemplate = {
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
};
