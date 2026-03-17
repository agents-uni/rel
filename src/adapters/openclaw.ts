/**
 * OpenClaw Memory Adapter — bridges OpenClaw session/workspace data
 * with the @agents-uni/rel event-sourced relationship system.
 *
 * This adapter implements MemoryAdapter from schema/types.ts,
 * reading session files from OpenClaw workspaces and converting them
 * into RelationshipEvents. It also writes relationship context back
 * to agent SOUL.md files.
 *
 * Design: filesystem-based, no runtime dependency on OpenClaw itself.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type {
  MemoryAdapter,
  RelationshipEvent,
  RelationshipContext,
} from '../schema/types.js';

// ═══════════════════════════════════════════════════════
//  Session file parsing
// ═══════════════════════════════════════════════════════

interface SessionEntry {
  timestamp: string;
  role: string;
  content: string;
  agentId?: string;
}

/**
 * Parse a session log file (markdown format) into structured entries.
 * OpenClaw sessions follow the pattern:
 *   ## <role> | <timestamp>
 *   <content>
 */
function parseSessionFile(content: string): SessionEntry[] {
  const entries: SessionEntry[] = [];
  const lines = content.split('\n');
  let current: Partial<SessionEntry> | null = null;
  const contentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(\w+)\s*\|\s*(.+)/);
    if (headerMatch) {
      if (current && current.timestamp) {
        entries.push({
          timestamp: current.timestamp,
          role: current.role ?? 'unknown',
          content: contentLines.join('\n').trim(),
          agentId: current.agentId,
        });
        contentLines.length = 0;
      }
      current = {
        role: headerMatch[1],
        timestamp: headerMatch[2].trim(),
      };
    } else if (current) {
      contentLines.push(line);
    }
  }

  // Flush last entry
  if (current?.timestamp) {
    entries.push({
      timestamp: current.timestamp,
      role: current.role ?? 'unknown',
      content: contentLines.join('\n').trim(),
      agentId: current.agentId,
    });
  }

  return entries;
}

/**
 * Infer event type and dimension impact from session content.
 * Uses keyword analysis to map natural-language interactions to typed events.
 */
function inferEventFromContent(content: string): {
  type: string;
  impact: Record<string, number>;
} {
  const lower = content.toLowerCase();

  // Collaboration signals
  if (lower.includes('完成') || lower.includes('成功') || lower.includes('completed') || lower.includes('success')) {
    return { type: 'task.completed', impact: { trust: 0.05, affinity: 0.03 } };
  }
  if (lower.includes('协作') || lower.includes('合作') || lower.includes('collaborate')) {
    return { type: 'collaboration.success', impact: { trust: 0.06, synergy: 0.04 } };
  }

  // Conflict signals
  if (lower.includes('冲突') || lower.includes('conflict') || lower.includes('disagreement')) {
    return { type: 'conflict.occurred', impact: { trust: -0.08, affinity: -0.05 } };
  }
  if (lower.includes('失败') || lower.includes('failed') || lower.includes('failure')) {
    return { type: 'task.failed', impact: { trust: -0.05, reliability: -0.08 } };
  }

  // Competition signals
  if (lower.includes('竞争') || lower.includes('compete') || lower.includes('比赛')) {
    return { type: 'competition.occurred', impact: { rivalry: 0.05, respect: 0.02 } };
  }
  if (lower.includes('赢') || lower.includes('won') || lower.includes('胜')) {
    return { type: 'competition.won', impact: { rivalry: 0.08, respect: -0.03 } };
  }
  if (lower.includes('输') || lower.includes('lost') || lower.includes('败')) {
    return { type: 'competition.lost', impact: { rivalry: 0.05, respect: 0.05 } };
  }

  // Alliance signals
  if (lower.includes('联盟') || lower.includes('alliance') || lower.includes('结盟')) {
    return { type: 'alliance.formed', impact: { trust: 0.1, loyalty: 0.08, affinity: 0.05 } };
  }
  if (lower.includes('背叛') || lower.includes('betray')) {
    return { type: 'alliance.betrayed', impact: { trust: -0.4, loyalty: -0.5, affinity: -0.3 } };
  }

  // Mentoring signals
  if (lower.includes('教') || lower.includes('teach') || lower.includes('mentor') || lower.includes('指导')) {
    return { type: 'mentoring.provided', impact: { knowledge_transfer: 0.08, trust: 0.03 } };
  }

  // Default: generic interaction
  return { type: 'interaction.general', impact: { affinity: 0.01 } };
}

// ═══════════════════════════════════════════════════════
//  OpenClaw Memory Adapter
// ═══════════════════════════════════════════════════════

export interface OpenClawAdapterOptions {
  /** OpenClaw base directory (default: ~/.openclaw) */
  openclawDir?: string;
  /** Custom event type inference function */
  inferEvent?: (content: string) => { type: string; impact: Record<string, number> };
}

export class OpenClawMemoryAdapter implements MemoryAdapter {
  private openclawDir: string;
  private inferEvent: (content: string) => { type: string; impact: Record<string, number> };

  constructor(options?: OpenClawAdapterOptions) {
    this.openclawDir = options?.openclawDir ?? join(homedir(), '.openclaw');
    this.inferEvent = options?.inferEvent ?? inferEventFromContent;
  }

  /**
   * Fetch interaction events from OpenClaw session files.
   * Scans all agent session directories for session logs
   * and converts them to RelationshipEvents.
   */
  async fetchEvents(since: string): Promise<RelationshipEvent[]> {
    const events: RelationshipEvent[] = [];
    const sinceTime = new Date(since).getTime();
    const agentsDir = join(this.openclawDir, 'agents');

    if (!existsSync(agentsDir)) return events;

    const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const agentDir of agentDirs) {
      const agentId = agentDir.name;
      const sessionsDir = join(agentsDir, agentId, 'sessions');

      if (!existsSync(sessionsDir)) continue;

      const sessionFiles = readdirSync(sessionsDir)
        .filter(f => f.endsWith('.md') || f.endsWith('.txt'));

      for (const file of sessionFiles) {
        try {
          const content = readFileSync(join(sessionsDir, file), 'utf-8');
          const entries = parseSessionFile(content);

          for (const entry of entries) {
            const entryTime = new Date(entry.timestamp).getTime();
            if (isNaN(entryTime) || entryTime <= sinceTime) continue;

            const { type, impact } = this.inferEvent(entry.content);

            // Extract mentioned agent IDs from content
            const participants = this.extractParticipants(entry.content, agentId);

            if (participants.length < 2) continue;

            events.push({
              id: `openclaw-${agentId}-${file}-${entry.timestamp}`,
              timestamp: entry.timestamp,
              type,
              participants,
              impact,
              description: entry.content.slice(0, 200),
              source: `openclaw:${agentId}:${file}`,
              metadata: { role: entry.role, sessionFile: file },
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Write relationship context to an agent's workspace.
   * Creates a RELATIONSHIPS.md file in the agent's workspace directory.
   */
  async writeContext(agentId: string, context: RelationshipContext): Promise<void> {
    const workspaceDir = join(this.openclawDir, `workspace-${agentId}`);

    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true });
    }

    const content = formatRelationshipContext(context);
    writeFileSync(join(workspaceDir, 'RELATIONSHIPS.md'), content, 'utf-8');
  }

  /**
   * Extract participant agent IDs from session content.
   * Tries to find @mentions or known agent IDs.
   */
  private extractParticipants(content: string, currentAgentId: string): string[] {
    const participants = new Set<string>([currentAgentId]);

    // Find @mentions (e.g., @zhenhuan, @emperor)
    const mentions = content.match(/@(\w+)/g);
    if (mentions) {
      for (const m of mentions) {
        participants.add(m.slice(1));
      }
    }

    // Also check if known agent directories are mentioned by name
    const agentsDir = join(this.openclawDir, 'agents');
    if (existsSync(agentsDir)) {
      try {
        const knownAgents = readdirSync(agentsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);

        for (const agent of knownAgents) {
          if (agent !== currentAgentId && content.includes(agent)) {
            participants.add(agent);
          }
        }
      } catch {
        // Ignore filesystem errors
      }
    }

    return [...participants];
  }
}

// ═══════════════════════════════════════════════════════
//  Context formatting
// ═══════════════════════════════════════════════════════

/**
 * Format RelationshipContext as a Markdown document
 * suitable for inclusion in SOUL.md or as a standalone file.
 */
export function formatRelationshipContext(context: RelationshipContext): string {
  const lines: string[] = [];

  lines.push(`# 关系网络 / Relationship Network`);
  lines.push('');
  lines.push(`> Generated: ${context.generatedAt}`);
  lines.push('');

  if (context.relationships.length === 0) {
    lines.push('_No relationships established yet._');
    return lines.join('\n');
  }

  // Sort by valence (strongest positive first)
  const sorted = [...context.relationships].sort((a, b) => b.valence - a.valence);

  for (const rel of sorted) {
    const name = rel.otherAgentName ?? rel.otherAgentId;
    const valenceEmoji = rel.valence > 0.3 ? '🟢' : rel.valence < -0.3 ? '🔴' : '🟡';

    lines.push(`## ${valenceEmoji} ${name}`);
    lines.push('');
    lines.push(rel.summary);
    lines.push('');

    // Dimension bars
    if (rel.dimensions.length > 0) {
      lines.push('| 维度 | 值 |');
      lines.push('|------|-----|');
      for (const dim of rel.dimensions) {
        const bar = dimensionBar(dim.value);
        lines.push(`| ${dim.type} | ${bar} ${dim.value.toFixed(2)} |`);
      }
      lines.push('');
    }

    if (rel.recentInteractions > 0) {
      lines.push(`_Recent interactions: ${rel.recentInteractions}_`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/** Visual bar for dimension values */
function dimensionBar(value: number): string {
  const normalized = (value + 1) / 2; // -1..1 → 0..1
  const filled = Math.round(normalized * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

/**
 * Generate a relationship section for SOUL.md.
 * Returns a Markdown fragment that can be inserted into SOUL.md.
 */
export function generateSoulRelationshipSection(
  context: RelationshipContext,
  language: 'zh' | 'en' = 'zh'
): string {
  const lines: string[] = [];
  const isZh = language === 'zh';

  lines.push(`## ${isZh ? '关系网络' : 'Relationship Network'}`);
  lines.push('');

  if (context.relationships.length === 0) {
    lines.push(isZh ? '_尚未建立任何关系。_' : '_No relationships established yet._');
    return lines.join('\n');
  }

  const sorted = [...context.relationships].sort((a, b) => b.valence - a.valence);

  for (const rel of sorted) {
    const name = rel.otherAgentName ?? rel.otherAgentId;
    const valenceLabel = rel.valence > 0.3
      ? (isZh ? '友好' : 'Friendly')
      : rel.valence < -0.3
        ? (isZh ? '敌对' : 'Hostile')
        : (isZh ? '中立' : 'Neutral');

    lines.push(`### ${name} (${valenceLabel})`);
    lines.push('');
    lines.push(rel.summary);
    lines.push('');

    // Top dimensions
    const topDims = rel.dimensions
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);

    for (const dim of topDims) {
      const bar = dimensionBar(dim.value);
      lines.push(`- **${dim.type}**: ${bar} \`${dim.value.toFixed(2)}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
