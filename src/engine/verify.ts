import type { EdgeDef, Goal, NodeDef, Topology, VerificationResult } from './types.ts';

export interface VerifyContext {
  usedNewEdges?: number;
  usedDeletes?: number;
  usedMoves?: number;
}

function getNode(nodes: NodeDef[], id: string): NodeDef | undefined {
  return nodes.find((n) => n.id === id);
}

function buildAdjacency(nodes: NodeDef[], edges: EdgeDef[]): Map<string, { to: string; weight: number }[]> {
  const adj = new Map<string, { to: string; weight: number }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.from === e.to) continue;
    adj.get(e.from)?.push({ to: e.to, weight: e.weight });
    if (e.bidirectional) adj.get(e.to)?.push({ to: e.from, weight: e.weight });
  }
  return adj;
}

function dijkstra(adj: Map<string, { to: string; weight: number }[]>, source: string): Map<string, { dist: number; hops: number }> {
  const dist = new Map<string, { dist: number; hops: number }>();
  for (const id of adj.keys()) dist.set(id, { dist: Infinity, hops: Infinity });
  dist.set(source, { dist: 0, hops: 0 });
  const unvisited = new Set(adj.keys());
  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      const d = dist.get(id)!.dist;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) break;
    unvisited.delete(current);
    for (const { to, weight } of adj.get(current) ?? []) {
      if (!unvisited.has(to)) continue;
      const next = dist.get(current)!;
      const alt = next.dist + weight;
      if (alt < dist.get(to)!.dist) {
        dist.set(to, { dist: alt, hops: next.hops + 1 });
      }
    }
  }
  return dist;
}

function hasCycleDFS(adj: Map<string, string[]>, node: string, visited: Set<string>, stack: Set<string>): boolean {
  visited.add(node);
  stack.add(node);
  for (const to of adj.get(node) ?? []) {
    if (!visited.has(to)) {
      if (hasCycleDFS(adj, to, visited, stack)) return true;
    } else if (stack.has(to)) {
      return true;
    }
  }
  stack.delete(node);
  return false;
}

function hasCycle(nodes: NodeDef[], edges: EdgeDef[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.from === e.to) continue;
    adj.get(e.from)?.push(e.to);
    if (e.bidirectional) adj.get(e.to)?.push(e.from);
  }
  const visited = new Set<string>();
  for (const n of nodes) {
    if (!visited.has(n.id) && hasCycleDFS(adj, n.id, visited, new Set<string>())) return true;
  }
  return false;
}

export function verify(topology: Topology, goal: Goal, ctx?: VerifyContext): VerificationResult {
  const { nodes, edges } = topology;
  const violations: string[] = [];
  let maxLatency = 0;
  let maxHops = 0;
  const cost = edges.length;

  const adj = buildAdjacency(nodes, edges);

  // For noCycle goals with source/targets, also check reachability
  if ((goal.type === 'noCycle' || goal.type === 'reachability') && goal.source) {
    const dist = dijkstra(adj, goal.source);
    const targets = goal.targets ?? [];
    for (const target of targets) {
      const node = getNode(nodes, target);
      const d = dist.get(target);
      if (!node || !d || d.dist === Infinity) {
        violations.push(`${node?.label ?? target} unreachable`);
        continue;
      }
      if (node.health !== undefined && node.health < 0.5) {
        violations.push(`${node.label} is unhealthy`);
      }
      maxLatency = Math.max(maxLatency, d.dist);
      maxHops = Math.max(maxHops, d.hops);
    }
  }

  for (const c of goal.constraints ?? []) {
    if (c.type === 'maxLatency' && c.value !== undefined && maxLatency > c.value) {
      violations.push(`Latency ${maxLatency} exceeds ${c.value}`);
    }
    if (c.type === 'maxHops' && c.value !== undefined && maxHops > c.value) {
      violations.push(`Path is ${maxHops} hops; max ${c.value}`);
    }
    if (c.type === 'avoidNode' && c.nodeId) {
      const used = edges.some((e) => e.from === c.nodeId || e.to === c.nodeId || (e.bidirectional && (e.from === c.nodeId || e.to === c.nodeId)));
      if (used) violations.push(`Topology uses avoided node ${getNode(nodes, c.nodeId)?.label ?? c.nodeId}`);
    }
  }

  if (goal.type === 'noCycle' || goal.constraints?.some((c) => c.type === 'noCycle')) {
    if (hasCycle(nodes, edges)) violations.push('Cycle detected');
  }

  // Enforce budget
  if (goal.budget && ctx) {
    if (goal.budget.newEdges !== undefined && (ctx.usedNewEdges ?? 0) > goal.budget.newEdges) {
      violations.push(`Used ${ctx.usedNewEdges} new edges; budget ${goal.budget.newEdges}`);
    }
    if (goal.budget.deletes !== undefined && (ctx.usedDeletes ?? 0) > goal.budget.deletes) {
      violations.push(`Used ${ctx.usedDeletes} deletes; budget ${goal.budget.deletes}`);
    }
    if (goal.budget.moves !== undefined && (ctx.usedMoves ?? 0) > goal.budget.moves) {
      violations.push(`Used ${ctx.usedMoves} moves; budget ${goal.budget.moves}`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    metrics: { latency: maxLatency, hops: maxHops, cost },
  };
}
