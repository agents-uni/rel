import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveTemplate,
  listTemplates,
  registerTemplate,
  getBuiltinTemplates,
} from '../../src/templates/registry.js';

describe('Template Registry', () => {
  describe('builtin templates', () => {
    const expectedTemplates = [
      'superior', 'subordinate', 'peer', 'competitive', 'ally', 'rival',
      'mentor', 'advisor', 'reviewer', 'delegate', 'serves',
      'collaborates', 'supervises', 'competes', 'audits', 'advises',
    ];

    for (const name of expectedTemplates) {
      it(`should have builtin template: ${name}`, () => {
        const template = resolveTemplate(name);
        expect(template).toBeDefined();
        expect(template!.name).toBe(name);
        expect(template!.dimensions.length).toBeGreaterThan(0);
        expect(template!.rules.length).toBeGreaterThan(0);
      });
    }

    it('should list all templates', () => {
      const names = listTemplates();
      expect(names.length).toBeGreaterThanOrEqual(expectedTemplates.length);
      for (const n of expectedTemplates) {
        expect(names).toContain(n);
      }
    });

    it('should return sorted template names', () => {
      const names = listTemplates();
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('should get all builtin templates as array', () => {
      const templates = getBuiltinTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(expectedTemplates.length);
      for (const t of templates) {
        expect(t.name).toBeDefined();
        expect(t.description).toBeDefined();
      }
    });
  });

  describe('template structure', () => {
    it('ally template should have trust, affinity, loyalty dimensions', () => {
      const ally = resolveTemplate('ally')!;
      const dimTypes = ally.dimensions.map(d => d.type);
      expect(dimTypes).toContain('trust');
      expect(dimTypes).toContain('affinity');
      expect(dimTypes).toContain('loyalty');
    });

    it('competitive template should have rivalry dimension', () => {
      const comp = resolveTemplate('competitive')!;
      const dimTypes = comp.dimensions.map(d => d.type);
      expect(dimTypes).toContain('rivalry');
    });

    it('superior template should have authority dimension', () => {
      const sup = resolveTemplate('superior')!;
      const authDim = sup.dimensions.find(d => d.type === 'authority');
      expect(authDim).toBeDefined();
      expect(authDim!.value).toBeGreaterThan(0);
    });

    it('rules should have valid structure', () => {
      const ally = resolveTemplate('ally')!;
      for (const rule of ally.rules) {
        expect(rule.on).toBeDefined();
        expect(typeof rule.on).toBe('string');
        expect(rule.adjust).toBeDefined();
        expect(Object.keys(rule.adjust).length).toBeGreaterThan(0);
      }
    });
  });

  describe('custom templates', () => {
    it('should register and resolve custom template', () => {
      registerTemplate({
        name: 'test-custom',
        description: 'A test template',
        dimensions: [{ type: 'custom_dim', value: 0.5 }],
        rules: [{ on: 'test.event', adjust: { custom_dim: 0.1 } }],
      });

      const resolved = resolveTemplate('test-custom');
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe('test-custom');
    });

    it('custom template should take priority over builtin', () => {
      registerTemplate({
        name: 'peer',
        description: 'Overridden peer template',
        dimensions: [{ type: 'override', value: 1.0 }],
        rules: [{ on: 'test', adjust: { override: 0.1 } }],
      });

      const resolved = resolveTemplate('peer');
      expect(resolved!.description).toBe('Overridden peer template');
      expect(resolved!.dimensions[0].type).toBe('override');
    });
  });

  describe('resolveTemplate', () => {
    it('should return undefined for non-existent template', () => {
      expect(resolveTemplate('does_not_exist_xyz')).toBeUndefined();
    });
  });
});
