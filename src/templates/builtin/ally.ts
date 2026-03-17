import type { RelationshipTemplate } from '../../schema/types.js';

export const ally: RelationshipTemplate = {
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
};
