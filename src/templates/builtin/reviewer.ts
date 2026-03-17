import type { RelationshipTemplate } from '../../schema/types.js';

export const reviewer: RelationshipTemplate = {
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
};
