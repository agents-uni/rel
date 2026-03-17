import type { RelationshipTemplate } from '../../schema/types.js';

export const subordinate: RelationshipTemplate = {
  name: 'subordinate',
  description: 'Reports to — A reports to B',
  dimensions: [
    { type: 'authority', value: -0.8 },
    { type: 'trust', value: 0.5 },
    { type: 'dependence', value: 0.6 },
  ],
  rules: [
    { on: 'task.completed_well', adjust: { trust: 0.05, dependence: -0.03 }, description: 'Competence reduces dependence' },
    { on: 'mentoring.received', adjust: { trust: 0.08, dependence: -0.05 } },
  ],
};
