import type { RelationshipTemplate } from '../../schema/types.js';

export const advisor: RelationshipTemplate = {
  name: 'advisor',
  description: 'Soft influence — A advises B without authority',
  dimensions: [
    { type: 'influence', value: 0.6 },
    { type: 'trust', value: 0.5 },
    { type: 'respect', value: 0.6 },
  ],
  rules: [
    { on: 'advice.followed_success', adjust: { influence: 0.08, trust: 0.05 } },
    { on: 'advice.followed_failure', adjust: { influence: -0.1, trust: -0.08 } },
    { on: 'advice.ignored', adjust: { influence: -0.05 } },
  ],
};
