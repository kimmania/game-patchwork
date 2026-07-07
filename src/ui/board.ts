import type { EdgeDef, LevelData, NodeDef, Topology } from '../engine/types.ts';

export type Tool = 'pan' | 'drag' | 'connect' | 'delete';
export type InteractionMode = { tool: Tool; sourceId?: string | null };

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface PanState {
  startX: number;
  startY: number;
  panStartX: number;
  panStartY: number;
}

const TYPE_COLORS: Record<string, string> = {
  source: '#4ade80',
  target: '#f87171',
  router: '#60a5fa',
  service: '#facc15',
  database: '#c084fc',
  cache: '#2dd4bf',
  gateway: '#fb923c',
  commit: '#94a3b8',
  package: '#f472b6',
};

const TYPE_LABELS: Record<string, string> = {
  source: 'SRC',
  target: 'DST',
  router: 'RTR',
  service: 'SVC',
  database: 'DB',
  cache: 'CA',
  gateway: 'GW',
  commit: 'CMT',
  package: 'PKG',
};

export class BoardRenderer {
  private level: LevelData;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private topology: Topology;
  private mode: InteractionMode = { tool: 'drag' };
  private pan = { x: 0, y: 0 };
  private scale = 1;
  private drag: DragState | null = null;
  private panState: PanState | null = null;
  private hoverNodeId: string | null = null;
  private selectedNodeId: string | null = null;
  private onChange?: (topology: Topology) => void;
  private onSelect?: (node: NodeDef | null) => void;
  private onModeChange?: (mode: InteractionMode) => void;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, level: LevelData, topology: Topology) {
    this.canvas = canvas;
    this.level = level;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unsupported');
    this.ctx = ctx;
    this.topology = topology;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    this.fitToLevel();
    this.bindEvents();
  }

  private fitToLevel() {
    const nodes = this.level.nodes;
    if (nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const padding = 60;
    const levelW = Math.max(1, maxX - minX + padding * 2);
    const levelH = Math.max(1, maxY - minY + padding * 2);
    this.scale = Math.min(width / levelW, height / levelH, 1.2);
    this.pan.x = (width - (minX + maxX) * this.scale) / 2;
    this.pan.y = (height - (minY + maxY) * this.scale) / 2;
    this.render();
  }

  setMode(mode: InteractionMode) {
    this.mode = mode;
    this.canvas.style.cursor = mode.tool === 'pan' ? 'grab' : 'default';
    this.onModeChange?.(mode);
  }

  getMode(): InteractionMode {
    return this.mode;
  }

  onTopologyChange(cb: (topology: Topology) => void) {
    this.onChange = cb;
  }

  onNodeSelect(cb: (node: NodeDef | null) => void) {
    this.onSelect = cb;
  }

  onModeChanged(cb: (mode: InteractionMode) => void) {
    this.onModeChange = cb;
  }

  setTopology(level: LevelData, topology: Topology) {
    this.level = level;
    this.topology = topology;
    this.selectedNodeId = null;
    this.hoverNodeId = null;
    this.drag = null;
    this.panState = null;
    this.mode = { tool: 'drag' };
    this.canvas.style.cursor = 'default';
    this.fitToLevel();
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width ?? window.innerWidth;
    const height = rect?.height ?? window.innerHeight;
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  private toWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.pan.x) / this.scale,
      y: (y - this.pan.y) / this.scale,
    };
  }

  private findNodeAt(x: number, y: number): NodeDef | null {
    const r = this.nodeRadius();
    for (let i = this.topology.nodes.length - 1; i >= 0; i--) {
      const n = this.topology.nodes[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  private findEdgeAt(x: number, y: number): EdgeDef | null {
    const r = this.nodeRadius();
    for (const e of this.topology.edges) {
      const from = this.topology.nodes.find((n) => n.id === e.from);
      const to = this.topology.nodes.find((n) => n.id === e.to);
      if (!from || !to) continue;
      const d = distToSegment(x, y, from.x, from.y, to.x, to.y, r);
      if (d < 12) return e;
    }
    return null;
  }

  private nodeRadius(): number {
    return Math.max(24, Math.min(36, this.canvas.clientWidth / 14));
  }

  private emitChange() {
    this.onChange?.({ nodes: this.topology.nodes.map((n) => ({ ...n })), edges: this.topology.edges.map((e) => ({ ...e })) });
  }

  private bindEvents() {
    const getPos = (e: PointerEvent): { x: number; y: number } => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      const pos = getPos(e);
      const world = this.toWorld(pos.x, pos.y);
      const node = this.findNodeAt(world.x, world.y);

      if (this.mode.tool === 'connect') {
        if (node) {
          if (this.mode.sourceId) {
            this.addEdge(this.mode.sourceId, node.id);
            this.mode.sourceId = null;
          } else {
            this.mode.sourceId = node.id;
            this.selectedNodeId = node.id;
          }
          this.render();
        }
        return;
      }

      if (this.mode.tool === 'delete') {
        if (node) {
          this.deleteNode(node.id);
        } else {
          const edge = this.findEdgeAt(world.x, world.y);
          if (edge) this.deleteEdge(edge.id);
        }
        return;
      }

      if (node) {
        this.drag = { nodeId: node.id, offsetX: world.x - node.x, offsetY: world.y - node.y };
        this.selectedNodeId = node.id;
        this.onSelect?.(node);
        this.render();
      } else {
        this.panState = { startX: pos.x, startY: pos.y, panStartX: this.pan.x, panStartY: this.pan.y };
        this.canvas.style.cursor = 'grabbing';
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const pos = getPos(e);
      const world = this.toWorld(pos.x, pos.y);

      if (this.drag) {
        const node = this.topology.nodes.find((n) => n.id === this.drag!.nodeId);
        if (node) {
          node.x = world.x - this.drag.offsetX;
          node.y = world.y - this.drag.offsetY;
          this.emitChange();
          this.render();
        }
      } else if (this.panState) {
        this.pan.x = this.panState.panStartX + (pos.x - this.panState.startX);
        this.pan.y = this.panState.panStartY + (pos.y - this.panState.startY);
        this.render();
      } else {
        const hover = this.findNodeAt(world.x, world.y);
        if (hover?.id !== this.hoverNodeId) {
          this.hoverNodeId = hover?.id ?? null;
          this.canvas.style.cursor = this.mode.tool === 'drag' && hover ? 'move' : this.mode.tool === 'pan' ? 'grab' : 'default';
          this.render();
        }
      }
    });

    const endPointer = (e: PointerEvent) => {
      e.preventDefault();
      this.drag = null;
      this.panState = null;
      this.canvas.style.cursor = this.mode.tool === 'pan' ? 'grab' : 'default';
    };
    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;
      const newScale = Math.min(Math.max(0.4, this.scale + delta), 3);
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.pan.x = mx - (mx - this.pan.x) * (newScale / this.scale);
      this.pan.y = my - (my - this.pan.y) * (newScale / this.scale);
      this.scale = newScale;
      this.render();
    }, { passive: false });

    window.addEventListener('resize', () => this.resize());
  }

  private addEdge(from: string, to: string) {
    if (from === to) return;
    if (this.topology.edges.some((e) => e.from === from && e.to === to)) return;
    const id = `e-${from}-${to}-${Date.now()}`;
    this.topology.edges.push({ id, from, to, weight: 10 });
    this.emitChange();
    this.render();
  }

  private deleteNode(id: string) {
    this.topology.nodes = this.topology.nodes.filter((n) => n.id !== id);
    this.topology.edges = this.topology.edges.filter((e) => e.from !== id && e.to !== id);
    this.selectedNodeId = null;
    this.emitChange();
    this.render();
  }

  private deleteEdge(id: string) {
    this.topology.edges = this.topology.edges.filter((e) => e.id !== id);
    this.emitChange();
    this.render();
  }

  render() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.scale, this.scale);

    this.drawEdges(ctx);
    this.drawNodes(ctx);

    ctx.restore();
  }

  private drawEdges(ctx: CanvasRenderingContext2D) {
    const r = this.nodeRadius();
    for (const e of this.topology.edges) {
      const from = this.topology.nodes.find((n) => n.id === e.from);
      const to = this.topology.nodes.find((n) => n.id === e.to);
      if (!from || !to) continue;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const x1 = from.x + Math.cos(angle) * r;
      const y1 = from.y + Math.sin(angle) * r;
      const x2 = to.x - Math.cos(angle) * r;
      const y2 = to.y - Math.sin(angle) * r;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.stroke();

      const headLen = 10;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = '#94a3b8';
      ctx.fill();

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `${Math.max(10, r * 0.45)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e.weight), midX, midY - 8);
    }
  }

  private drawNodes(ctx: CanvasRenderingContext2D) {
    const r = this.nodeRadius();
    const fontSize = Math.max(10, r * 0.5);

    for (const n of this.topology.nodes) {
      const isSelected = n.id === this.selectedNodeId;
      const isSource = this.mode.tool === 'connect' && this.mode.sourceId === n.id;
      const isHover = n.id === this.hoverNodeId;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = TYPE_COLORS[n.type] ?? '#94a3b8';
      ctx.fill();

      if (isSelected || isSource) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isHover) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
      } else {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1f2937';
        ctx.stroke();
      }

      if (n.health !== undefined) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * n.health);
        ctx.strokeStyle = n.health > 0.5 ? '#4ade80' : '#f87171';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TYPE_LABELS[n.type] ?? '?', n.x, n.y - fontSize * 0.25);
      ctx.font = `${fontSize * 0.75}px system-ui, sans-serif`;
      ctx.fillStyle = '#1f2937';
      ctx.fillText(n.label, n.x, n.y + fontSize * 0.8);
    }
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number, _pad: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}
