/**
 * Impact Resolver — fills in missing event impact from template rules.
 *
 * When an event is processed with an empty impact map, this module
 * resolves default impacts by matching the event type against the
 * relationship's template rules.
 */

import type { Relationship, EvolutionRule } from '../schema/types.js';
import { resolveTemplate } from '../templates/registry.js';

/**
 * Resolve impact from template rules when the provided impact is empty.
 *
 * Scans the relationship's tags for matching templates, collects all
 * rule adjustments that match the event type, and returns their aggregated impact.
 */
export function resolveImpactFromTemplates(
  eventType: string,
  relationship: Relationship
): Record<string, number> {
  const impact: Record<string, number> = {};
  const seenTemplates = new Set<string>();

  // Check tags for template matches
  for (const tag of relationship.tags ?? []) {
    if (seenTemplates.has(tag)) continue;
    seenTemplates.add(tag);

    const template = resolveTemplate(tag);
    if (!template) continue;

    for (const rule of template.rules) {
      if (matchesEventType(eventType, rule.on)) {
        for (const [dimType, delta] of Object.entries(rule.adjust)) {
          impact[dimType] = (impact[dimType] ?? 0) + delta;
        }
      }
    }
  }

  // Also check dimension types for template matches
  for (const dim of relationship.dimensions) {
    if (seenTemplates.has(dim.type)) continue;
    seenTemplates.add(dim.type);

    const template = resolveTemplate(dim.type);
    if (!template) continue;

    for (const rule of template.rules) {
      if (matchesEventType(eventType, rule.on)) {
        for (const [dimType, delta] of Object.entries(rule.adjust)) {
          impact[dimType] = (impact[dimType] ?? 0) + delta;
        }
      }
    }
  }

  return impact;
}

/** Simple glob matching (same logic as engine.ts) */
function matchesEventType(eventType: string, rulePattern: string): boolean {
  if (rulePattern === eventType) return true;
  if (rulePattern === '*') return true;
  if (rulePattern.endsWith('.*')) {
    const prefix = rulePattern.slice(0, -2);
    return eventType.startsWith(prefix + '.');
  }
  return false;
}

/**
 * Get contextual dimension defaults based on event type.
 *
 * Instead of hardcoded confidence=0.2 / volatility=0.5 for new dimensions,
 * this returns values that make sense for the type of event that created them.
 */
export function getContextualDimensionDefaults(
  dimType: string,
  eventType: string
): { confidence: number; volatility: number } {
  // Conflict/betrayal events create volatile, low-confidence dimensions
  if (eventType.includes('betray') || eventType.includes('conflict') || eventType.includes('attack')) {
    return { confidence: 0.3, volatility: 0.7 };
  }

  // Collaboration events create moderate-confidence, moderate-volatility
  if (eventType.includes('collaborat') || eventType.includes('cooperat') || eventType.includes('alliance')) {
    return { confidence: 0.4, volatility: 0.4 };
  }

  // Competition events create moderate volatility
  if (eventType.includes('competi') || eventType.includes('rival')) {
    return { confidence: 0.3, volatility: 0.5 };
  }

  // Trust-related dimensions tend to be volatile
  if (dimType === 'trust') {
    return { confidence: 0.25, volatility: 0.5 };
  }

  // Affinity/loyalty are relatively stable once established
  if (dimType === 'affinity' || dimType === 'loyalty') {
    return { confidence: 0.3, volatility: 0.35 };
  }

  // Default
  return { confidence: 0.2, volatility: 0.5 };
}
