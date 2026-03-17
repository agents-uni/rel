import { describe, it, expect } from 'vitest';
import { fromLegacy, fromLegacyArray, fromYamlObject } from '../../src/adapters/yaml.js';
import type { LegacyRelationshipDefinition } from '../../src/adapters/yaml.js';

describe('Legacy YAML Adapter', () => {
  describe('fromLegacy', () => {
    it('should convert legacy definition with known type', () => {
      const legacy: LegacyRelationshipDefinition = {
        from: 'emperor',
        to: 'empress',
        type: 'superior',
        weight: 0.9,
      };

      const seed = fromLegacy(legacy);
      expect(seed.from).toBe('emperor');
      expect(seed.to).toBe('empress');
      expect(seed.type).toBe('superior');
      expect(seed.weight).toBe(0.9);
    });

    it('should map all known legacy types', () => {
      const knownTypes = [
        'superior', 'subordinate', 'peer', 'competitive', 'ally', 'rival',
        'mentor', 'advisor', 'reviewer', 'delegate', 'serves',
        'collaborates', 'supervises', 'competes', 'audits', 'advises',
      ];

      for (const type of knownTypes) {
        const seed = fromLegacy({ from: 'a', to: 'b', type });
        expect(seed.type).toBe(type);
      }
    });

    it('should pass through unknown types', () => {
      const seed = fromLegacy({ from: 'a', to: 'b', type: 'custom_type' });
      expect(seed.type).toBe('custom_type');
    });

    it('should generate dimensions from weight when no type', () => {
      const seed = fromLegacy({ from: 'a', to: 'b', weight: 0.7 });

      expect(seed.dimensions).toBeDefined();
      expect(seed.dimensions!.length).toBe(2);

      const affinityDim = seed.dimensions!.find(d => d.type === 'affinity');
      expect(affinityDim).toBeDefined();
      expect(affinityDim!.value).toBeCloseTo(0.56, 2); // 0.7 * 0.8

      const trustDim = seed.dimensions!.find(d => d.type === 'trust');
      expect(trustDim).toBeDefined();
      expect(trustDim!.value).toBeCloseTo(0.42, 2); // 0.7 * 0.6
    });

    it('should handle negative weight', () => {
      const seed = fromLegacy({ from: 'a', to: 'b', weight: -0.5 });

      expect(seed.dimensions).toBeDefined();
      const affinityDim = seed.dimensions!.find(d => d.type === 'affinity');
      expect(affinityDim!.value).toBeLessThan(0);
    });

    it('should preserve tags', () => {
      const seed = fromLegacy({ from: 'a', to: 'b', type: 'peer', tags: ['team-a'] });
      expect(seed.tags).toEqual(['team-a']);
    });

    it('should preserve metadata', () => {
      const seed = fromLegacy({
        from: 'a',
        to: 'b',
        type: 'peer',
        metadata: { context: 'palace' },
      });
      expect(seed.metadata).toEqual({ context: 'palace' });
    });

    it('should handle minimal definition', () => {
      const seed = fromLegacy({ from: 'a', to: 'b' });
      expect(seed.from).toBe('a');
      expect(seed.to).toBe('b');
      expect(seed.type).toBeUndefined();
      expect(seed.dimensions).toBeUndefined();
    });
  });

  describe('fromLegacyArray', () => {
    it('should convert array of definitions', () => {
      const defs: LegacyRelationshipDefinition[] = [
        { from: 'a', to: 'b', type: 'peer' },
        { from: 'b', to: 'c', type: 'ally' },
      ];

      const seeds = fromLegacyArray(defs);
      expect(seeds).toHaveLength(2);
    });

    it('should handle bidirectional relationships', () => {
      const defs: LegacyRelationshipDefinition[] = [
        { from: 'a', to: 'b', type: 'peer', bidirectional: true },
      ];

      const seeds = fromLegacyArray(defs);
      expect(seeds).toHaveLength(2);
      expect(seeds[0].from).toBe('a');
      expect(seeds[0].to).toBe('b');
      expect(seeds[1].from).toBe('b');
      expect(seeds[1].to).toBe('a');
    });

    it('should handle empty array', () => {
      expect(fromLegacyArray([])).toHaveLength(0);
    });
  });

  describe('fromYamlObject', () => {
    it('should parse relationships from YAML structure', () => {
      const yamlData = {
        relationships: [
          { from: 'emperor', to: 'empress', type: 'superior', weight: 0.9 },
          { from: 'zhenhuan', to: 'emperor', type: 'serves' },
        ],
      };

      const seeds = fromYamlObject(yamlData);
      expect(seeds).toHaveLength(2);
      expect(seeds[0].type).toBe('superior');
      expect(seeds[1].type).toBe('serves');
    });

    it('should return empty array for missing relationships key', () => {
      expect(fromYamlObject({})).toHaveLength(0);
    });

    it('should return empty array for non-array relationships', () => {
      expect(fromYamlObject({ relationships: 'not-array' as unknown as undefined })).toHaveLength(0);
    });
  });
});
