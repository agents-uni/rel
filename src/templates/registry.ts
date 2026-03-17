/**
 * Template Registry — pre-built relationship patterns.
 *
 * Built-in templates live in `./builtin/` — one file per template.
 * To contribute a new template, add a file there and re-export from `./builtin/index.ts`.
 */

import type { RelationshipTemplate } from '../schema/types.js';

import * as builtin from './builtin/index.js';

// ═══ Load all builtin templates into a Map ═══

const builtinTemplates: Map<string, RelationshipTemplate> = new Map();

for (const [key, template] of Object.entries(builtin)) {
  const t = template as RelationshipTemplate;
  // Aliases (competes, advises) share the same object but need their own name
  builtinTemplates.set(key, { ...t, name: key });
}

// ═══ Custom template registry ═══

const customTemplates: Map<string, RelationshipTemplate> = new Map();

/** Register a custom template */
export function registerTemplate(template: RelationshipTemplate): void {
  customTemplates.set(template.name, template);
}

/** Register multiple templates at once */
export function registerTemplates(templates: RelationshipTemplate[]): void {
  for (const t of templates) {
    customTemplates.set(t.name, t);
  }
}

/** Resolve a template by name (custom takes priority over builtin) */
export function resolveTemplate(name: string): RelationshipTemplate | undefined {
  return customTemplates.get(name) ?? builtinTemplates.get(name);
}

/** List all available template names */
export function listTemplates(): string[] {
  const names = new Set<string>();
  for (const k of builtinTemplates.keys()) names.add(k);
  for (const k of customTemplates.keys()) names.add(k);
  return [...names].sort();
}

/** Get all builtin templates */
export function getBuiltinTemplates(): RelationshipTemplate[] {
  return [...builtinTemplates.values()];
}
