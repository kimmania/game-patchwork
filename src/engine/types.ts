export type NodeType = 'source' | 'target' | 'router' | 'service' | 'database' | 'cache' | 'gateway' | 'commit' | 'package' | 'retry';

export interface NodeDef {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  fixed?: boolean;
  capacity?: number;
  health?: number;
}

export interface EdgeDef {
  id: string;
  from: string;
  to: string;
  weight: number;
  bidirectional?: boolean;
}

export type ConstraintType = 'maxLatency' | 'avoidNode' | 'noCycle' | 'maxHops' | 'minRedundancy' | 'maxCapacity' | 'noOrphans' | 'versionRequires';

export interface Constraint {
  type: ConstraintType;
  value?: number;
  nodeId?: string;
  requiresNode?: string;
  requiresVersion?: string;
}

export interface Budget {
  newEdges?: number;
  newNodes?: number;
  deletes?: number;
  moves?: number;
  rewires?: number;
}

export interface Goal {
  type: 'reachability' | 'noCycle' | 'minLatency' | 'surviveFailure' | 'linearize';
  source?: string;
  targets?: string[];
  constraints?: Constraint[];
  budget?: Budget;
}

export interface LevelData {
  id: string;
  category: string;
  title: string;
  description?: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
  goal: Goal;
  palette: { type: NodeType | 'edge'; count: number }[];
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface Topology {
  nodes: NodeDef[];
  edges: EdgeDef[];
}

export interface VerificationResult {
  passed: boolean;
  violations: string[];
  metrics: {
    latency: number;
    hops: number;
    cost: number;
  };
}

export interface SaveData {
  levelId: string;
  topology: Topology;
  history: Topology[];
  bestMetrics: { latency: number; hops: number; cost: number };
  viewedSource: boolean;
  seenHelp: boolean;
}

export const SAVE_KEY = 'patchwork-save';
export const SEEN_HELP_KEY = 'patchwork-seen-help';
