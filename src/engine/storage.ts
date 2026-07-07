import { SAVE_KEY, SEEN_HELP_KEY, type SaveData, type Topology } from './types.ts';

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    localStorage.setItem(SEEN_HELP_KEY, data.seenHelp ? '1' : '0');
  } catch {
    // ignore quota errors
  }
}

export function loadGame(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSeenHelp(): boolean {
  return localStorage.getItem(SEEN_HELP_KEY) === '1';
}

export function markSeenHelp(): void {
  localStorage.setItem(SEEN_HELP_KEY, '1');
}

export function cloneTopology(topology: Topology): Topology {
  return {
    nodes: topology.nodes.map((n) => ({ ...n })),
    edges: topology.edges.map((e) => ({ ...e })),
  };
}

export function topologyEqual(a: Topology, b: Topology): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    const an = a.nodes[i];
    const bn = b.nodes[i];
    if (an.id !== bn.id || an.x !== bn.x || an.y !== bn.y || an.type !== bn.type || an.label !== bn.label) return false;
  }
  for (let i = 0; i < a.edges.length; i++) {
    const ae = a.edges[i];
    const be = b.edges[i];
    if (ae.from !== be.from || ae.to !== be.to || ae.weight !== be.weight || ae.bidirectional !== be.bidirectional) return false;
  }
  return true;
}

export function createSave(levelId: string, topology: Topology): SaveData {
  return {
    levelId,
    topology: cloneTopology(topology),
    history: [],
    stars: [false, false, false, false],
    bestMetrics: { latency: Infinity, hops: Infinity, cost: Infinity },
    viewedSource: false,
    seenHelp: false,
  };
}
