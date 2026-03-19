import type { RelationshipTemplate } from '../../schema/types.js';

export const rival: RelationshipTemplate = {
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
  migrations: [
    {
      targetTemplate: 'ally',
      when: [
        { dimension: 'trust', operator: 'above', value: 0.5 },
        { dimension: 'rivalry', operator: 'below', value: 0.2 },
      ],
    },
  ],
};
