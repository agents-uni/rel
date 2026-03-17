import type { RelationshipTemplate } from '../../schema/types.js';

export const mentor: RelationshipTemplate = {
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
};
