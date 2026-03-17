/**
 * Built-in relationship templates.
 *
 * Each file exports a single RelationshipTemplate.
 * To contribute a new template, create a new file in this folder
 * and add its export here.
 */

export { superior } from './superior.js';
export { subordinate } from './subordinate.js';
export { peer } from './peer.js';
export { competitive } from './competitive.js';
export { ally } from './ally.js';
export { rival } from './rival.js';
export { mentor } from './mentor.js';
export { advisor } from './advisor.js';
export { reviewer } from './reviewer.js';
export { delegate } from './delegate.js';
export { serves } from './serves.js';
export { collaborates } from './collaborates.js';
export { supervises } from './supervises.js';
export { audits } from './audits.js';

// Aliases — these share definitions with their base templates
export { competitive as competes } from './competitive.js';
export { advisor as advises } from './advisor.js';
