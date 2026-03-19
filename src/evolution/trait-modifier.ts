/**
 * Trait Modifier — adjusts relationship evolution deltas based on agent traits.
 *
 * Agents with specific personality traits (deception, intelligence, analytical, etc.)
 * affect how relationship dimensions change during events. For example, a highly
 * deceptive agent suppresses trust decay when they are the source of betrayal.
 */

import type { TraitRegistry, TraitModifierRule } from '../schema/types.js';

/** Built-in trait modifier rules */
const BUILTIN_RULES: TraitModifierRule[] = [
  {
    trait: 'deception',
    threshold: 0.6,
    appliesTo: 'source',
    affectedDimensions: ['trust'],
    multiplier: 0.6,
    description: 'High deception suppresses trust decay when source (harder to detect betrayal)',
  },
  {
    trait: 'analytical',
    threshold: 0.6,
    appliesTo: 'source',
    affectedDimensions: ['knowledge_transfer'],
    multiplier: 1.4,
    description: 'Analytical agents amplify knowledge transfer gains',
  },
  {
    trait: 'intelligence',
    threshold: 0.7,
    appliesTo: 'target',
    affectedDimensions: ['trust'],
    multiplier: 1.3,
    description: 'Intelligent targets detect betrayal more easily — trust drops faster',
  },
  {
    trait: 'charisma',
    threshold: 0.6,
    appliesTo: 'source',
    affectedDimensions: ['affinity', 'loyalty'],
    multiplier: 1.3,
    description: 'Charismatic agents amplify affinity and loyalty gains',
  },
  {
    trait: 'empathy',
    threshold: 0.6,
    appliesTo: 'target',
    affectedDimensions: ['affinity'],
    multiplier: 1.2,
    description: 'Empathetic targets form affinity bonds more readily',
  },
  {
    trait: 'ambition',
    threshold: 0.7,
    appliesTo: 'source',
    affectedDimensions: ['rivalry'],
    multiplier: 1.3,
    description: 'Ambitious agents escalate rivalry faster',
  },
];

/**
 * Apply trait-based modifiers to dimension deltas.
 *
 * For each modifier rule, if the relevant agent has the trait above threshold,
 * the corresponding dimension deltas are multiplied by the rule's multiplier.
 * Only negative deltas are modified for suppression rules (multiplier < 1)
 * when the dimension name implies trust/loyalty.
 */
export function applyTraitModifiers(
  totalAdjust: Record<string, number>,
  fromId: string,
  toId: string,
  _eventType: string,
  traitRegistry: TraitRegistry,
  customRules?: TraitModifierRule[]
): Record<string, number> {
  const rules = customRules ?? BUILTIN_RULES;
  const result = { ...totalAdjust };

  const sourceTraits = traitRegistry[fromId] ?? {};
  const targetTraits = traitRegistry[toId] ?? {};

  for (const rule of rules) {
    let applies = false;

    if (rule.appliesTo === 'source' || rule.appliesTo === 'both') {
      if ((sourceTraits[rule.trait] ?? 0) >= rule.threshold) {
        applies = true;
      }
    }
    if (rule.appliesTo === 'target' || rule.appliesTo === 'both') {
      if ((targetTraits[rule.trait] ?? 0) >= rule.threshold) {
        applies = true;
      }
    }

    if (!applies) continue;

    for (const [dimType, delta] of Object.entries(result)) {
      // Check if this dimension is affected
      if (rule.affectedDimensions && rule.affectedDimensions.length > 0) {
        if (!rule.affectedDimensions.includes(dimType)) continue;
      }

      // For suppression (multiplier < 1), only affect deltas in the "expected" direction:
      // - If multiplier < 1, it suppresses. For trust-like dims we only suppress negative deltas.
      // - If multiplier > 1, it amplifies. We amplify all matching deltas.
      if (rule.multiplier < 1) {
        // Suppress: only modify negative deltas (decay suppression)
        if (delta < 0) {
          result[dimType] = delta * rule.multiplier;
        }
      } else {
        // Amplify: modify all matching deltas
        result[dimType] = delta * rule.multiplier;
      }
    }
  }

  return result;
}

/** Get the built-in trait modifier rules */
export function getBuiltinTraitRules(): TraitModifierRule[] {
  return [...BUILTIN_RULES];
}
