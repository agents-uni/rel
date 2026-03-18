/**
 * Visualization data types — standardized output format for graph rendering.
 *
 * These types define the contract between @agents-uni/rel and any
 * visualization consumer (core dashboard, chat sidebar, etc.).
 * Designed for vis-network but deliberately generic.
 */

// ═══════════════════════════════════════════════════════
//  Visualization Data Structures
// ═══════════════════════════════════════════════════════

export interface VisualizationNode {
  /** Agent identifier */
  id: string;
  /** Display label (name or ID) */
  label: string;
  /** Agent role */
  role?: string;
  /** Agent department */
  department?: string;
  /** Influence score (0-1), drives node size */
  influence: number;
  /** Total connections */
  connectionCount: number;
  /** Cluster membership */
  clusterId?: string;
}

export interface VisualizationEdge {
  /** Unique edge identifier */
  id: string;
  /** Source agent */
  from: string;
  /** Target agent */
  to: string;
  /** All dimension data */
  dimensions: Array<{
    type: string;
    value: number;
    confidence: number;
  }>;
  /** Computed overall strength (0-1), drives edge width */
  strength: number;
  /** Emotional valence (-1 to +1), drives edge color */
  valence: number;
  /** Total interaction count */
  interactionCount: number;
}

export interface VisualizationCluster {
  /** Cluster identifier */
  id: string;
  /** Member agent IDs */
  members: string[];
  /** Internal cohesion score (0-1) */
  cohesion: number;
}

/**
 * Complete visualization payload — everything a renderer needs.
 */
export interface VisualizationData {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  clusters: VisualizationCluster[];
  /** ISO timestamp of data generation */
  generatedAt: string;
}

/**
 * Options for controlling visualization output.
 */
export interface VisualizationOptions {
  /** Agent metadata for richer labels (id → { name, role, department }) */
  agentMetadata?: Record<string, {
    name?: string;
    role?: string;
    department?: string;
  }>;
  /** Dimension type used for cluster detection */
  clusterDimensionType?: string;
  /** Minimum dimension value for cluster connectivity */
  clusterMinValue?: number;
}
