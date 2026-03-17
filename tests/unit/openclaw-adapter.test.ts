import { describe, it, expect } from 'vitest';
import {
  formatRelationshipContext,
  generateSoulRelationshipSection,
} from '../../src/adapters/openclaw.js';
import type { RelationshipContext } from '../../src/schema/types.js';

describe('OpenClaw Adapter', () => {
  const mockContext: RelationshipContext = {
    agentId: 'zhenhuan',
    relationships: [
      {
        otherAgentId: 'emperor',
        otherAgentName: '皇帝',
        summary: 'Trusted ruler with strong loyalty bond',
        dimensions: [
          { type: 'loyalty', value: 0.8 },
          { type: 'trust', value: 0.7 },
          { type: 'devotion', value: 0.6 },
        ],
        valence: 0.7,
        recentInteractions: 12,
      },
      {
        otherAgentId: 'huafei',
        otherAgentName: '华妃',
        summary: 'Bitter rival with deep mistrust',
        dimensions: [
          { type: 'rivalry', value: 0.8 },
          { type: 'trust', value: -0.6 },
        ],
        valence: -0.5,
        recentInteractions: 8,
      },
      {
        otherAgentId: 'shenmeizhuang',
        otherAgentName: '沈眉庄',
        summary: 'Closest ally and confidant',
        dimensions: [
          { type: 'trust', value: 0.9 },
          { type: 'affinity', value: 0.85 },
          { type: 'loyalty', value: 0.8 },
        ],
        valence: 0.8,
        recentInteractions: 20,
      },
    ],
    generatedAt: '2026-03-16T00:00:00Z',
  };

  describe('formatRelationshipContext', () => {
    it('should format as markdown', () => {
      const md = formatRelationshipContext(mockContext);

      expect(md).toContain('# 关系网络');
      expect(md).toContain('沈眉庄'); // highest valence first
      expect(md).toContain('华妃');
      expect(md).toContain('皇帝');
    });

    it('should sort by valence (most positive first)', () => {
      const md = formatRelationshipContext(mockContext);
      const shenIndex = md.indexOf('沈眉庄');
      const emperorIndex = md.indexOf('皇帝');
      const huafeiIndex = md.indexOf('华妃');

      // 沈眉庄 (0.8) > 皇帝 (0.7) > 华妃 (-0.5)
      expect(shenIndex).toBeLessThan(emperorIndex);
      expect(emperorIndex).toBeLessThan(huafeiIndex);
    });

    it('should include dimension bars', () => {
      const md = formatRelationshipContext(mockContext);
      expect(md).toContain('█');
      expect(md).toContain('░');
    });

    it('should include valence emoji indicators', () => {
      const md = formatRelationshipContext(mockContext);
      expect(md).toContain('🟢'); // positive
      expect(md).toContain('🔴'); // negative
    });

    it('should handle empty relationships', () => {
      const emptyContext: RelationshipContext = {
        agentId: 'test',
        relationships: [],
        generatedAt: '2026-03-16T00:00:00Z',
      };

      const md = formatRelationshipContext(emptyContext);
      expect(md).toContain('No relationships established yet');
    });

    it('should include recent interaction count', () => {
      const md = formatRelationshipContext(mockContext);
      expect(md).toContain('Recent interactions: 20');
    });
  });

  describe('generateSoulRelationshipSection', () => {
    it('should generate Chinese section by default', () => {
      const section = generateSoulRelationshipSection(mockContext, 'zh');
      expect(section).toContain('## 关系网络');
      expect(section).toContain('友好');
      expect(section).toContain('敌对');
    });

    it('should generate English section', () => {
      const section = generateSoulRelationshipSection(mockContext, 'en');
      expect(section).toContain('## Relationship Network');
      expect(section).toContain('Friendly');
      expect(section).toContain('Hostile');
    });

    it('should show top 3 dimensions per relationship', () => {
      const section = generateSoulRelationshipSection(mockContext);
      // 沈眉庄 has 3 dimensions, all should show
      expect(section).toContain('trust');
      expect(section).toContain('affinity');
      expect(section).toContain('loyalty');
    });

    it('should handle empty relationships', () => {
      const section = generateSoulRelationshipSection({
        agentId: 'test',
        relationships: [],
        generatedAt: new Date().toISOString(),
      });
      expect(section).toContain('尚未建立任何关系');
    });
  });
});
