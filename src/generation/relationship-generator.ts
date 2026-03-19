/**
 * RelationshipGenerator — generates relationship seeds from agent descriptions.
 *
 * Two modes:
 * - Heuristic (default, zero dependencies): keyword analysis + rank gap → relationship type
 * - LLM (optional callback): structured prompt → parsed JSON → fallback to heuristic
 */

import type {
  RelationshipSeed,
  RelationshipTemplate,
  TraitRegistry,
} from '../schema/types.js';
import { listTemplates, resolveTemplate } from '../templates/registry.js';

/** Minimal agent info needed for relationship generation */
export interface AgentInfo {
  id: string;
  name: string;
  role?: string;
  rank?: number;
  department?: string;
  traits?: Record<string, number>;
  description?: string;
}

/** LLM provider interface — any SDK can implement this in ~5 lines */
export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

export interface GenerateOptions {
  /** Universe type hint: affects heuristic weighting */
  type?: 'competitive' | 'hierarchical' | 'flat' | 'hybrid';
  /** Optional LLM provider for smarter generation */
  llm?: LLMProvider;
  /** Language for LLM prompts */
  language?: 'zh' | 'en';
  /** Maximum relationships to generate (default: agents * 2) */
  maxRelationships?: number;
}

export interface GenerateResult {
  seeds: RelationshipSeed[];
  traitRegistry: TraitRegistry;
  /** Human-readable explanation of decisions */
  reasoning: string[];
}

export class RelationshipGenerator {
  /**
   * Generate relationship seeds from a description and agent list.
   *
   * Heuristic mode analyzes agent attributes (rank, department, traits)
   * to infer appropriate relationship types.
   */
  async generate(
    description: string,
    agents: AgentInfo[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    // Try LLM mode first if provider is given
    if (options?.llm) {
      try {
        return await this.generateWithLLM(description, agents, options);
      } catch {
        // Fall through to heuristic
      }
    }

    return this.generateHeuristic(description, agents, options);
  }

  /** Heuristic generation: keyword analysis + rank gaps + trait matching */
  private generateHeuristic(
    description: string,
    agents: AgentInfo[],
    options?: GenerateOptions
  ): GenerateResult {
    const seeds: RelationshipSeed[] = [];
    const reasoning: string[] = [];
    const universeType = options?.type ?? inferUniverseType(description);
    const maxRels = options?.maxRelationships ?? agents.length * 2;

    // Build trait registry
    const traitRegistry: TraitRegistry = {};
    for (const agent of agents) {
      if (agent.traits && Object.keys(agent.traits).length > 0) {
        traitRegistry[agent.id] = agent.traits;
      }
    }

    // Sort agents by rank (descending) for hierarchy detection
    const ranked = [...agents].sort((a, b) => (b.rank ?? 50) - (a.rank ?? 50));

    // Phase 1: Hierarchical relationships (rank gap >= 20)
    for (let i = 0; i < ranked.length; i++) {
      for (let j = i + 1; j < ranked.length; j++) {
        if (seeds.length >= maxRels) break;

        const a = ranked[i];
        const b = ranked[j];
        const rankGap = (a.rank ?? 50) - (b.rank ?? 50);

        if (rankGap >= 20) {
          seeds.push({ from: a.id, to: b.id, type: 'superior' });
          seeds.push({ from: b.id, to: a.id, type: 'subordinate' });
          reasoning.push(`${a.name}(rank:${a.rank}) → ${b.name}(rank:${b.rank}): superior/subordinate (gap:${rankGap})`);
        }
      }
    }

    // Phase 2: Same-department peers
    const departments = new Map<string, AgentInfo[]>();
    for (const agent of agents) {
      if (agent.department) {
        const list = departments.get(agent.department) ?? [];
        list.push(agent);
        departments.set(agent.department, list);
      }
    }

    for (const [dept, members] of departments) {
      const sameLevelMembers = members.filter(m => {
        const isAlreadyLinked = seeds.some(
          s => (s.from === m.id || s.to === m.id) && (s.type === 'superior' || s.type === 'subordinate')
        );
        return !isAlreadyLinked || true; // Keep all — peers can coexist with hierarchy
      });

      for (let i = 0; i < sameLevelMembers.length; i++) {
        for (let j = i + 1; j < sameLevelMembers.length; j++) {
          if (seeds.length >= maxRels) break;

          const a = sameLevelMembers[i];
          const b = sameLevelMembers[j];
          const rankGap = Math.abs((a.rank ?? 50) - (b.rank ?? 50));

          if (rankGap < 20) {
            const relType = choosePeerRelType(a, b, universeType);
            seeds.push({ from: a.id, to: b.id, type: relType });
            reasoning.push(`${a.name} ↔ ${b.name}: ${relType} (same dept:${dept}, gap:${rankGap})`);
          }
        }
      }
    }

    // Phase 3: Unconnected agents — connect based on universe type
    const connected = new Set<string>();
    for (const seed of seeds) {
      connected.add(seed.from);
      connected.add(seed.to);
    }

    const unconnected = agents.filter(a => !connected.has(a.id));
    for (let i = 0; i < unconnected.length; i++) {
      for (let j = i + 1; j < unconnected.length; j++) {
        if (seeds.length >= maxRels) break;

        const a = unconnected[i];
        const b = unconnected[j];
        const relType = choosePeerRelType(a, b, universeType);
        seeds.push({ from: a.id, to: b.id, type: relType });
        reasoning.push(`${a.name} ↔ ${b.name}: ${relType} (unconnected pair)`);
      }
    }

    // Phase 4: Trait-based special relationships
    for (let i = 0; i < agents.length && seeds.length < maxRels; i++) {
      for (let j = i + 1; j < agents.length && seeds.length < maxRels; j++) {
        const a = agents[i];
        const b = agents[j];

        // Skip if already have too many connections
        const existingCount = seeds.filter(
          s => s.from === a.id && s.to === b.id || s.from === b.id && s.to === a.id
        ).length;
        if (existingCount >= 2) continue;

        const traitRel = inferFromTraits(a, b);
        if (traitRel) {
          seeds.push({ from: a.id, to: b.id, type: traitRel.type });
          reasoning.push(`${a.name} ↔ ${b.name}: ${traitRel.type} (${traitRel.reason})`);
        }
      }
    }

    return { seeds: seeds.slice(0, maxRels), traitRegistry, reasoning };
  }

  /** LLM-powered generation with structured prompts */
  private async generateWithLLM(
    description: string,
    agents: AgentInfo[],
    options: GenerateOptions
  ): Promise<GenerateResult> {
    const lang = options.language ?? 'en';
    const templates = listTemplates();

    const prompt = lang === 'zh'
      ? buildZhPrompt(description, agents, templates)
      : buildEnPrompt(description, agents, templates);

    const response = await options.llm!.generate(prompt);

    try {
      const parsed = JSON.parse(extractJSON(response));
      const seeds: RelationshipSeed[] = [];
      const reasoning: string[] = [`LLM generated ${parsed.relationships?.length ?? 0} relationships`];

      for (const rel of parsed.relationships ?? []) {
        if (rel.from && rel.to && rel.type) {
          // Validate template exists
          const template = resolveTemplate(rel.type);
          if (template) {
            seeds.push({ from: rel.from, to: rel.to, type: rel.type });
          } else {
            seeds.push({ from: rel.from, to: rel.to, type: 'peer' });
            reasoning.push(`Unknown template "${rel.type}" for ${rel.from}→${rel.to}, defaulted to peer`);
          }
        }
      }

      const traitRegistry: TraitRegistry = {};
      for (const agent of agents) {
        if (agent.traits) traitRegistry[agent.id] = agent.traits;
      }

      return { seeds, traitRegistry, reasoning };
    } catch {
      // Parse failed — fall back to heuristic
      return this.generateHeuristic(description, agents, options);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────

function inferUniverseType(description: string): 'competitive' | 'hierarchical' | 'flat' | 'hybrid' {
  const lower = description.toLowerCase();
  if (lower.includes('竞争') || lower.includes('competi') || lower.includes('arena') || lower.includes('后宫')) {
    return 'competitive';
  }
  if (lower.includes('层级') || lower.includes('hierarch') || lower.includes('军') || lower.includes('military')) {
    return 'hierarchical';
  }
  if (lower.includes('扁平') || lower.includes('flat') || lower.includes('team')) {
    return 'flat';
  }
  return 'hybrid';
}

function choosePeerRelType(
  a: AgentInfo,
  b: AgentInfo,
  universeType: string
): string {
  if (universeType === 'competitive') {
    return 'competitive';
  }
  if (universeType === 'flat') {
    return 'peer';
  }

  // Hybrid: check traits for rivalry indicators
  const aAmbition = a.traits?.ambition ?? 0;
  const bAmbition = b.traits?.ambition ?? 0;
  if (aAmbition > 0.6 && bAmbition > 0.6) {
    return 'rival';
  }

  const aRank = a.rank ?? 50;
  const bRank = b.rank ?? 50;
  if (Math.abs(aRank - bRank) < 10) {
    return 'peer';
  }

  return 'competitive';
}

function inferFromTraits(
  a: AgentInfo,
  b: AgentInfo
): { type: string; reason: string } | null {
  if (!a.traits || !b.traits) return null;

  // High deception + high intelligence → rival
  if ((a.traits.deception ?? 0) > 0.7 && (b.traits.intelligence ?? 0) > 0.7) {
    return { type: 'rival', reason: 'deception vs intelligence' };
  }

  // Both have high empathy → ally
  if ((a.traits.empathy ?? 0) > 0.6 && (b.traits.empathy ?? 0) > 0.6) {
    return { type: 'ally', reason: 'mutual empathy' };
  }

  // One analytical, one creative → collaborates
  if ((a.traits.analytical ?? 0) > 0.7 && (b.traits.creativity ?? 0) > 0.7) {
    return { type: 'collaborates', reason: 'analytical + creative complementarity' };
  }
  if ((b.traits.analytical ?? 0) > 0.7 && (a.traits.creativity ?? 0) > 0.7) {
    return { type: 'collaborates', reason: 'creative + analytical complementarity' };
  }

  return null;
}

function buildEnPrompt(description: string, agents: AgentInfo[], templates: string[]): string {
  const agentList = agents.map(a =>
    `- id: "${a.id}", name: "${a.name}", role: "${a.role ?? 'unknown'}", rank: ${a.rank ?? 50}${a.traits ? `, traits: ${JSON.stringify(a.traits)}` : ''}`
  ).join('\n');

  return `You are a relationship designer for a multi-agent system.

Given this scenario: "${description}"

And these agents:
${agentList}

Available relationship templates: ${templates.join(', ')}

Generate a JSON object with a "relationships" array. Each element has:
- "from": source agent id
- "to": target agent id
- "type": one of the available templates

Rules:
- Every agent should have at least one relationship
- Use relationship types that make narrative sense
- Consider rank differences for hierarchy
- Consider traits for rivalry/alliance decisions

Return ONLY valid JSON, no markdown fences.`;
}

function buildZhPrompt(description: string, agents: AgentInfo[], templates: string[]): string {
  const agentList = agents.map(a =>
    `- id: "${a.id}", 名字: "${a.name}", 角色: "${a.role ?? '未知'}", 等级: ${a.rank ?? 50}${a.traits ? `, 特质: ${JSON.stringify(a.traits)}` : ''}`
  ).join('\n');

  return `你是一个多智能体系统的关系设计师。

场景描述："${description}"

智能体列表：
${agentList}

可用关系模板：${templates.join(', ')}

生成一个 JSON 对象，包含 "relationships" 数组。每个元素包含：
- "from": 源智能体 id
- "to": 目标智能体 id
- "type": 可用模板之一

规则：
- 每个智能体至少有一个关系
- 使用叙事上合理的关系类型
- 考虑等级差异建立上下级关系
- 考虑特质决定对抗/联盟关系

仅返回合法 JSON，不要 markdown 代码块。`;
}

/** Extract JSON from LLM response (handles markdown fences) */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code block
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Try to find raw JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return text.trim();
}
