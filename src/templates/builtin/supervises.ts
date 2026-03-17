import type { RelationshipTemplate } from '../../schema/types.js';

export const supervises: RelationshipTemplate = {
  name: 'supervises',
  description: 'Management — alias for superior with management nuance',
  dimensions: [
    { type: 'authority', value: 0.7 },
    { type: 'trust', value: 0.5 },
    { type: 'empowerment', value: 0.4 },
  ],
  rules: [
    { on: 'task.completed_well', adjust: { trust: 0.05, empowerment: 0.06 } },
    { on: 'task.failed', adjust: { trust: -0.08, empowerment: -0.1 } },
    { on: 'autonomy.granted', adjust: { empowerment: 0.1, trust: 0.05 } },
  ],
};
