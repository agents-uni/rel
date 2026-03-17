import type { RelationshipTemplate } from '../../schema/types.js';

export const serves: RelationshipTemplate = {
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
};
