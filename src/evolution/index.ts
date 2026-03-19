export { EvolutionEngine } from './engine.js';
export type { EvolutionResult, EvolutionEngineOptions } from './engine.js';

export { applyTraitModifiers, getBuiltinTraitRules } from './trait-modifier.js';
export { resolveImpactFromTemplates, getContextualDimensionDefaults } from './impact-resolver.js';
export { checkMigration, executeMigration } from './migration.js';
export type { MigrationResult } from './migration.js';
