import type { RelationshipTemplate } from '../../schema/types.js';

export const audits: RelationshipTemplate = {
  name: 'audits',
  description: 'Audit/oversight relationship',
  dimensions: [
    { type: 'authority', value: 0.5 },
    { type: 'trust', value: 0.4 },
    { type: 'transparency', value: 0.6 },
  ],
  rules: [
    { on: 'audit.clean', adjust: { trust: 0.08, transparency: 0.05 } },
    { on: 'audit.issues_found', adjust: { trust: -0.1, transparency: -0.08 } },
    { on: 'audit.resolved', adjust: { trust: 0.05, transparency: 0.1 } },
  ],
};
