import './style.css';
import { firstLevelId, getLevel, LEVELS, nextLevelId } from './engine/levels.ts';
import { cloneTopology, createSave, hasSeenHelp, loadGame, markSeenHelp, saveGame } from './engine/storage.ts';
import type { NodeDef, SaveData, Topology } from './engine/types.ts';
import { verify, type VerifyContext } from './engine/verify.ts';
import { BoardRenderer, type Tool } from './ui/board.ts';
import { hideModal, showModal, showToast } from './ui/modal.ts';

export async function bootstrap(): Promise<void> {
  new App().init();
}

class App {
  private level = getLevel(firstLevelId())!;
  private topology: Topology = cloneTopology(this.level);
  private save: SaveData = createSave(this.level.id, this.topology);
  private renderer!: BoardRenderer;
  private unlocked = new Set<string>([firstLevelId()]);
  private completed = new Set<string>();
  private usedNewEdges = 0;
  private usedDeletes = 0;
  private usedMoves = 0;
  private usedRewires = 0;

  private get els() {
    return {
      menuBtn: document.getElementById('menu-btn')!,
      legendBtn: document.getElementById('legend-btn')!,
      helpBtn: document.getElementById('help-btn')!,
      undoBtn: document.getElementById('undo-btn')!,
      resetBtn: document.getElementById('reset-btn')!,
      connectBtn: document.getElementById('connect-btn')!,
      rewireBtn: document.getElementById('rewire-btn')!,
      deleteBtn: document.getElementById('delete-btn')!,
      sourceBtn: document.getElementById('source-btn')!,
      verifyBtn: document.getElementById('verify-btn')!,
      verifyMsg: document.getElementById('verify-msg')!,
      levelName: document.getElementById('level-name')!,
      goalBanner: document.getElementById('goal-banner')!,
      board: document.getElementById('board') as HTMLCanvasElement,
    };
  }

  init() {
    const saved = loadGame();
    if (saved) {
      this.save = saved;
      const level = getLevel(saved.levelId);
      if (level) {
        this.level = level;
        this.topology = cloneTopology(saved.topology);
      }
      this.unlocked = new Set(LEVELS.map((l) => l.id));
      this.completed = new Set(LEVELS.filter((_, i) => i < LEVELS.findIndex((l) => l.id === saved.levelId)).map((l) => l.id));
    }

    this.renderer = new BoardRenderer(this.els.board, this.level, this.topology);
    this.renderer.onTopologyChange((t) => this.handleTopologyChange(t));
    this.renderer.onNodeSelect((n) => this.handleNodeSelect(n));
    this.renderer.onActionFired((action) => this.handleAction(action));

    // Expose for testing
    (window as unknown as { __app: unknown }).__app = this;

    this.bindControls();
    this.updateHeader();
    this.updateToolButtons();

    if (!hasSeenHelp()) {
      setTimeout(() => this.showHelp(), 300);
    }
  }

  private handleTopologyChange(topology: Topology) {
    this.topology = topology;
    this.save.topology = cloneTopology(topology);
    saveGame(this.save);
  }

  private handleNodeSelect(_node: NodeDef | null) {
    // future: show detail panel
  }

  private handleAction(action: 'connect' | 'delete' | 'move' | 'rewire') {
    if (action === 'connect') this.usedNewEdges++;
    if (action === 'delete') this.usedDeletes++;
    if (action === 'move') this.usedMoves++;
    if (action === 'rewire') this.usedRewires++;
    this.updateGoalBanner();
  }

  private bindControls() {
    this.els.menuBtn.addEventListener('click', () => this.showLevelList());
    this.els.legendBtn.addEventListener('click', () => this.showLegend());
    this.els.helpBtn.addEventListener('click', () => this.showHelp());
    this.els.undoBtn.addEventListener('click', () => this.undo());
    this.els.resetBtn.addEventListener('click', () => this.resetLevel());
    this.els.connectBtn.addEventListener('click', () => this.setTool('connect'));
    this.els.rewireBtn.addEventListener('click', () => this.setTool('rewire'));
    this.els.deleteBtn.addEventListener('click', () => this.setTool('delete'));
    this.els.sourceBtn.addEventListener('click', () => this.openSource());
    this.els.verifyBtn.addEventListener('click', () => this.runVerify());
  }

  private setTool(tool: Tool) {
    const current = this.renderer.getMode().tool;
    if (tool === current) {
      // Toggle off — return to drag mode
      this.renderer.setMode({ tool: 'drag' });
    } else {
      this.renderer.setMode({ tool });
    }
    this.updateToolButtons();
  }

  private updateToolButtons() {
    const mode = this.renderer.getMode();
    this.els.connectBtn.classList.toggle('active', mode.tool === 'connect');
    this.els.rewireBtn.classList.toggle('active', mode.tool === 'rewire');
    this.els.deleteBtn.classList.toggle('active', mode.tool === 'delete');
  }

  private updateHeader() {
    this.els.levelName.textContent = `${this.level.title} • ${this.level.category}`;
    const hasSource = !!this.level.sourceUrl;
    this.els.sourceBtn.style.display = hasSource ? '' : 'none';
    this.updateGoalBanner();
  }

  private updateGoalBanner() {
    const goal = this.level.goal;
    const nodes = this.level.nodes;
    const parts: string[] = [];

    // Goal type description
    if (goal.type === 'reachability' && goal.source && goal.targets) {
      const srcLabel = nodes.find((n) => n.id === goal.source)?.label ?? goal.source;
      const targetLabels = goal.targets.map((t) => nodes.find((n) => n.id === t)?.label ?? t).join(', ');
      parts.push(`Route from <strong>${srcLabel}</strong> to <strong>${targetLabels}</strong>`);
    } else if (goal.type === 'noCycle') {
      parts.push('Eliminate all cycles in the graph');
    } else if (goal.type === 'minLatency') {
      parts.push('Minimize latency across the topology');
    } else if (goal.type === 'surviveFailure') {
      parts.push('Ensure the system survives a node failure');
    } else if (goal.type === 'linearize') {
      parts.push('Rewire edges into a single linear chain (no branches)');
    }

    // Constraints
    const constraintParts: string[] = [];
    for (const c of goal.constraints ?? []) {
      if (c.type === 'maxLatency' && c.value !== undefined) {
        constraintParts.push(`latency ≤ ${c.value}`);
      } else if (c.type === 'maxHops' && c.value !== undefined) {
        constraintParts.push(`≤ ${c.value} hops`);
      } else if (c.type === 'avoidNode' && c.nodeId) {
        const label = nodes.find((n) => n.id === c.nodeId)?.label ?? c.nodeId;
        constraintParts.push(`avoid ${label}`);
      } else if (c.type === 'noCycle') {
        constraintParts.push('no cycles');
      }
    }
    if (constraintParts.length > 0) {
      parts.push(`(${constraintParts.join(', ')})`);
    }

    // Budget pills
    const budget = goal.budget;
    const pills: string[] = [];
    if (budget) {
      if (budget.newEdges !== undefined) pills.push(`${budget.newEdges - this.usedNewEdges} edges left`);
      if (budget.moves !== undefined) pills.push(`${budget.moves - this.usedMoves} moves left`);
      if (budget.deletes !== undefined) pills.push(`${budget.deletes - this.usedDeletes} deletes left`);
      if (budget.rewires !== undefined) pills.push(`${budget.rewires - this.usedRewires} rewires left`);
    }

    const text = parts.join(' ');
    const pillsHtml = pills.map((p) => `<span class="budget-pill">${p}</span>`).join('');
    this.els.goalBanner.innerHTML = `<span class="goal-icon">🎯</span><span class="goal-text">${text}</span>${pillsHtml}`;
  }

  private showLegend() {
    const types: { type: string; abbr: string; label: string; color: string }[] = [
      { type: 'source', abbr: 'SRC', label: 'Source — traffic origin', color: '#4ade80' },
      { type: 'target', abbr: 'DST', label: 'Target — destination', color: '#f87171' },
      { type: 'router', abbr: 'RTR', label: 'Router — forwards traffic', color: '#60a5fa' },
      { type: 'service', abbr: 'SVC', label: 'Service — application node', color: '#facc15' },
      { type: 'database', abbr: 'DB', label: 'Database — data store', color: '#c084fc' },
      { type: 'cache', abbr: 'CA', label: 'Cache — fast lookup', color: '#2dd4bf' },
      { type: 'gateway', abbr: 'GW', label: 'Gateway — entry point', color: '#fb923c' },
      { type: 'commit', abbr: 'CMT', label: 'Commit — git history node', color: '#94a3b8' },
      { type: 'package', abbr: 'PKG', label: 'Package — dependency', color: '#f472b6' },
      { type: 'retry', abbr: 'RTY', label: 'Retry — halves downstream latency', color: '#a78bfa' },
    ];

    const rows = types.map((t) => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${t.color}">${t.abbr}</span>
        <span class="legend-label">${t.label}</span>
      </div>
    `).join('');

    const healthRow = `
      <div class="legend-row">
        <span class="legend-ring healthy"></span>
        <span class="legend-label">Green ring — healthy node (health &gt; 50%)</span>
      </div>
      <div class="legend-row">
        <span class="legend-ring unhealthy"></span>
        <span class="legend-label">Red ring — unhealthy node (avoid in paths)</span>
      </div>
    `;

    showModal('Node Legend', `<div id="legend-list">${rows}${healthRow}</div>`, [{ label: 'Close', primary: true }]);
  }

  private runVerify() {
    const ctx: VerifyContext = {
      usedNewEdges: this.usedNewEdges,
      usedDeletes: this.usedDeletes,
      usedMoves: this.usedMoves,
    };
    const result = verify(this.topology, this.level.goal, ctx);
    this.els.verifyMsg.classList.remove('success', 'error');
    if (result.passed) {
      this.els.verifyMsg.classList.add('success');
      this.els.verifyMsg.textContent = `Verified! Latency ${result.metrics.latency}, hops ${result.metrics.hops}.`;
      this.handleWin(result);
    } else {
      this.els.verifyMsg.classList.add('error');
      this.els.verifyMsg.textContent = result.violations.join('; ');
    }
  }

  private handleWin(result: ReturnType<typeof verify>) {
    this.completed.add(this.level.id);
    const next = nextLevelId(this.level.id);
    if (next) this.unlocked.add(next);
    this.save.bestMetrics = {
      latency: Math.min(this.save.bestMetrics.latency, result.metrics.latency),
      hops: Math.min(this.save.bestMetrics.hops, result.metrics.hops),
      cost: Math.min(this.save.bestMetrics.cost, result.metrics.cost),
    };
    saveGame(this.save);
    this.updateHeader();

    // Check if user stayed within budget
    const b = this.level.goal.budget;
    const overBudget: string[] = [];
    if (b) {
      if (b.newEdges !== undefined && this.usedNewEdges > b.newEdges) overBudget.push(`${this.usedNewEdges} edges (budget ${b.newEdges})`);
      if (b.deletes !== undefined && this.usedDeletes > b.deletes) overBudget.push(`${this.usedDeletes} deletes (budget ${b.deletes})`);
      if (b.moves !== undefined && this.usedMoves > b.moves) overBudget.push(`${this.usedMoves} moves (budget ${b.moves})`);
      if (b.rewires !== undefined && this.usedRewires > b.rewires) overBudget.push(`${this.usedRewires} rewires (budget ${b.rewires})`);
    }
    const withinBudget = overBudget.length === 0;

    const buttons: { label: string; primary?: boolean; action?: () => void }[] = [
      { label: 'Try Again', action: () => this.resetLevel() },
    ];
    if (next) {
      buttons.push({ label: 'Next Level', primary: true, action: () => this.loadLevel(next) });
    }

    const metricsHtml = `<p>Latency ${result.metrics.latency} · ${result.metrics.hops} hops · ${result.metrics.cost} edges.</p>`;
    const budgetHtml = withinBudget
      ? '<p>All constraints satisfied within budget.</p>'
      : `<p>Solved, but could be done in fewer moves: ${overBudget.join(', ')}.</p>`;
    const title = withinBudget ? 'Topology Restored' : 'Solved — Over Budget';
    showModal(title, `${budgetHtml}${metricsHtml}`, buttons);
  }

  private undo() {
    const previous = this.renderer.popHistory();
    if (!previous) {
      showToast('Nothing to undo');
      return;
    }
    this.topology = cloneTopology(previous);
    this.save.topology = cloneTopology(this.topology);
    saveGame(this.save);
    this.renderer.restoreTopology(this.topology);
    this.setTool('drag');
  }

  private resetLevel() {
    this.topology = cloneTopology(this.level);
    this.save.topology = cloneTopology(this.topology);
    this.save.history = [];
    this.usedNewEdges = 0;
    this.usedDeletes = 0;
    this.usedMoves = 0;
    this.usedRewires = 0;
    saveGame(this.save);
    this.renderer.setTopology(this.level, this.topology);
    this.setTool('drag');
    this.updateHeader();
    this.clearVerifyMsg();
  }

  private loadLevel(id: string) {
    const level = getLevel(id);
    if (!level) return;
    this.level = level;
    this.topology = cloneTopology(level);
    this.save = createSave(id, this.topology);
    this.save.seenHelp = true;
    this.usedNewEdges = 0;
    this.usedDeletes = 0;
    this.usedMoves = 0;
    this.usedRewires = 0;
    saveGame(this.save);
    this.renderer.setTopology(this.level, this.topology);
    this.setTool('drag');
    this.updateHeader();
    this.clearVerifyMsg();
  }

  private clearVerifyMsg() {
    this.els.verifyMsg.textContent = '';
    this.els.verifyMsg.classList.remove('success', 'error');
  }

  private showHelp() {
    const hide = showModal('How to Play', `
      <p>Patchwork puzzles are real-world topologies: networks, schemas, commits, and dependencies.</p>
      <p>The <strong>goal banner</strong> at the top of the board tells you what to achieve — route traffic, break cycles, or repair connections. Read it first!</p>
      <p>Manipulate the graph to satisfy the goal, then tap <strong>Verify</strong> (blue button in the tool bar).</p>
      <ul>
        <li><strong>Drag</strong> a node to reposition it. Just press and hold on any node, then drag.</li>
        <li><strong>Connect</strong>: First tap the <strong>Connect</strong> button to enter connect mode. Then tap the <strong>starting node</strong> — it will glow green and pulse to show it's armed. Next tap the <strong>destination node</strong> to create a directed edge (arrow) from start to destination. Edges are directional, so tap order matters!</li>
        <li><strong>Rewire</strong>: Tap the <strong>Rewire</strong> button, then tap an existing <strong>edge</strong> (it turns purple). Tap a new <strong>destination node</strong> to redirect the edge. This is how you rebase git history — no commits deleted, just rewired.</li>
        <li><strong>Delete</strong>: First tap the <strong>Delete</strong> button to enter delete mode. Then tap any <strong>node</strong> or <strong>connection line</strong> to remove it. Edges turn red when you hover over them in delete mode.</li>
        <li><strong>Pinch / scroll</strong> to zoom and pan the canvas.</li>
      </ul>
      <p>Not sure what a shape means? Tap the <strong>◮ Legend</strong> button in the top bar to see node types and health indicators.</p>
      <p>Tap <strong>Learn</strong> to open the real-world source behind each puzzle.</p>
    `, [{ label: 'Got it', primary: true, action: () => {
      if (!hasSeenHelp()) {
        markSeenHelp();
        this.save.seenHelp = true;
        saveGame(this.save);
      }
    }}]);
    return hide;
  }

  private showLevelList() {
    const rows = LEVELS.map((l) => {
      const locked = !this.unlocked.has(l.id);
      const done = this.completed.has(l.id);
      return `<div class="level-row ${locked ? 'locked' : ''}" data-id="${l.id}">
        <span class="id">${l.id}</span>
        <span class="title">${l.title}</span>
        <span>${done ? '✓' : locked ? '🔒' : ''}</span>
      </div>`;
    }).join('');
    showModal('Levels', `<div id="level-list">${rows}</div>`, [{ label: 'Close' }]);
    document.querySelectorAll('#level-list .level-row').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id')!;
        if (this.unlocked.has(id)) {
          hideModal();
          this.loadLevel(id);
        } else {
          showToast('Complete previous levels to unlock');
        }
      });
    });
  }

  private openSource() {
    if (!this.level.sourceUrl) return;
    this.save.viewedSource = true;
    saveGame(this.save);
    this.updateHeader();
    window.open(this.level.sourceUrl, '_blank', 'noopener,noreferrer');
  }
}
