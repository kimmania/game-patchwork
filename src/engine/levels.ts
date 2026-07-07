import type { LevelData } from './types.ts';

export const LEVELS: LevelData[] = [
  {
    id: 'tut-01',
    category: 'tutorial',
    title: 'First Hop',
    description: 'Drag the router between the client and server, then connect them.',
    nodes: [
      { id: 'client', type: 'source', label: 'Client', x: 100, y: 200 },
      { id: 'router', type: 'router', label: 'Router', x: 260, y: 200 },
      { id: 'server', type: 'target', label: 'Server', x: 420, y: 200 },
    ],
    edges: [],
    goal: {
      type: 'reachability',
      source: 'client',
      targets: ['server'],
      constraints: [{ type: 'maxHops', value: 2 }],
      budget: { newEdges: 2 },
    },
    palette: [{ type: 'edge', count: 2 }],
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Glossary/Router',
    sourceTitle: 'MDN — Router',
  },
  {
    id: 'net-01',
    category: 'packet-routing',
    title: 'Shard Split',
    description: 'Route traffic around the failing shard to reach both replicas.',
    nodes: [
      { id: 'client', type: 'source', label: 'Client', x: 80, y: 220 },
      { id: 'lb', type: 'router', label: 'LB-A', x: 240, y: 120 },
      { id: 'shard1', type: 'service', label: 'Shard-1', x: 400, y: 80, health: 0.2 },
      { id: 'shard2', type: 'service', label: 'Shard-2', x: 400, y: 220, health: 1.0 },
      { id: 'shard3', type: 'service', label: 'Shard-3', x: 400, y: 360, health: 1.0 },
    ],
    edges: [
      { id: 'e1', from: 'client', to: 'lb', weight: 10 },
      { id: 'e2', from: 'lb', to: 'shard1', weight: 15 },
    ],
    goal: {
      type: 'reachability',
      source: 'client',
      targets: ['shard2', 'shard3'],
      constraints: [
        { type: 'maxLatency', value: 120 },
        { type: 'avoidNode', nodeId: 'shard1' },
      ],
      budget: { newEdges: 2, moves: 3 },
    },
    palette: [{ type: 'edge', count: 2 }],
    sourceUrl: 'https://sre.google/sre-book/load-balancing-frontend/',
    sourceTitle: 'Google SRE Book — Load Balancing',
  },
  {
    id: 'db-01',
    category: 'schema-repair',
    title: 'Orphan Orders',
    description: 'Reconnect the orders table to its customer without using the deprecated archive.',
    nodes: [
      { id: 'orders', type: 'database', label: 'Orders', x: 120, y: 200 },
      { id: 'archive', type: 'database', label: 'Archive', x: 320, y: 120, health: 0.0 },
      { id: 'customers', type: 'database', label: 'Customers', x: 320, y: 280, health: 1.0 },
    ],
    edges: [
      { id: 'e1', from: 'orders', to: 'archive', weight: 1 },
    ],
    goal: {
      type: 'reachability',
      source: 'orders',
      targets: ['customers'],
      constraints: [{ type: 'avoidNode', nodeId: 'archive' }],
      budget: { newEdges: 1, moves: 1 },
    },
    palette: [{ type: 'edge', count: 1 }],
    sourceUrl: 'https://en.wikipedia.org/wiki/Foreign_key',
    sourceTitle: 'Wikipedia — Foreign Key',
  },
  {
    id: 'git-01',
    category: 'merge-maze',
    title: 'Linearize History',
    description: 'Break the merge commit and re-order edges so history is a straight line.',
    nodes: [
      { id: 'root', type: 'commit', label: 'main~2', x: 80, y: 200 },
      { id: 'a', type: 'commit', label: 'feature-a', x: 220, y: 120 },
      { id: 'b', type: 'commit', label: 'feature-b', x: 220, y: 280 },
      { id: 'merge', type: 'commit', label: 'merge', x: 360, y: 200 },
      { id: 'tip', type: 'commit', label: 'main', x: 500, y: 200 },
    ],
    edges: [
      { id: 'e1', from: 'root', to: 'a', weight: 1 },
      { id: 'e2', from: 'root', to: 'b', weight: 1 },
      { id: 'e3', from: 'a', to: 'merge', weight: 1 },
      { id: 'e4', from: 'b', to: 'merge', weight: 1 },
      { id: 'e5', from: 'merge', to: 'tip', weight: 1 },
    ],
    goal: {
      type: 'noCycle',
      source: 'root',
      targets: ['tip'],
      constraints: [{ type: 'maxHops', value: 4 }],
      budget: { newEdges: 1, deletes: 1, moves: 2 },
    },
    palette: [{ type: 'edge', count: 1 }],
    sourceUrl: 'https://git-scm.com/docs/git-rebase',
    sourceTitle: 'Git — git-rebase',
  },
  {
    id: 'dep-01',
    category: 'dependency-lock',
    title: 'Break the Cycle',
    description: 'Remove one edge to break the circular dependency between packages.',
    nodes: [
      { id: 'ui', type: 'package', label: '@app/ui', x: 200, y: 100 },
      { id: 'utils', type: 'package', label: '@app/utils', x: 400, y: 100 },
      { id: 'core', type: 'package', label: '@app/core', x: 300, y: 280 },
    ],
    edges: [
      { id: 'e1', from: 'ui', to: 'core', weight: 1 },
      { id: 'e2', from: 'core', to: 'utils', weight: 1 },
      { id: 'e3', from: 'utils', to: 'ui', weight: 1 },
    ],
    goal: {
      type: 'noCycle',
      constraints: [{ type: 'maxHops', value: 3 }],
      budget: { deletes: 1, moves: 1 },
    },
    palette: [],
    sourceUrl: 'https://docs.npmjs.com/cli/v10/configuring-npm/folders',
    sourceTitle: 'npm — Folders',
  },
  {
    id: 'svc-01',
    category: 'api-orchestration',
    title: 'Failover Chain',
    description: 'Add a gateway and route around the unhealthy service while keeping latency under 130.',
    nodes: [
      { id: 'ingress', type: 'gateway', label: 'Ingress', x: 80, y: 220 },
      { id: 'auth', type: 'service', label: 'Auth', x: 240, y: 220, health: 0.3 },
      { id: 'payments', type: 'service', label: 'Payments', x: 420, y: 140, health: 1.0 },
      { id: 'fallback', type: 'service', label: 'Fallback', x: 420, y: 300, health: 1.0 },
    ],
    edges: [
      { id: 'e1', from: 'ingress', to: 'auth', weight: 10 },
      { id: 'e2', from: 'auth', to: 'payments', weight: 40 },
    ],
    goal: {
      type: 'reachability',
      source: 'ingress',
      targets: ['payments', 'fallback'],
      constraints: [{ type: 'maxLatency', value: 130 }],
      budget: { newEdges: 2, moves: 2 },
    },
    palette: [{ type: 'edge', count: 2 }],
    sourceUrl: 'https://microservices.io/patterns/reliability/circuitbreaker.html',
    sourceTitle: 'Microservices.io — Circuit Breaker',
  },
];

export function getLevel(id: string): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function firstLevelId(): string {
  return LEVELS[0].id;
}

export function nextLevelId(current: string): string | null {
  const idx = LEVELS.findIndex((l) => l.id === current);
  return LEVELS[idx + 1]?.id ?? null;
}
