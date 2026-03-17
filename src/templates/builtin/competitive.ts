import type { RelationshipTemplate } from '../../schema/types.js';

export const competitive: RelationshipTemplate = {
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
};
