type SceneCtor = new () => Scene;

export interface GameOptions {
  container?: string;
  background?: string;
  pixelArt?: boolean;
  worldHeight?: number;
  scenes?: Record<string, SceneCtor>;
}

export interface MsdfFont {
  family: string;
}

export interface MsdfText {
  text: string;
  style: MsdfTextStyle;
  font: MsdfFont;
}

export interface MsdfTextStyle {
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  color?: string | { top?: string; bottom?: string };
  outline?: { width?: number; color?: string };
  shadow?: { x?: number; y?: number; color?: string; alpha?: number; softness?: number };
}

export interface DrawTextOpts {
  align?: 'left' | 'center' | 'right';
  color?: string;
  size?: number;
  bold?: boolean;
  wrap?: number;
}

export interface PanelStyle {
  base?: 'panel' | 'flat' | 'inset' | 'glossy' | 'bar';
  hover?: boolean;
  pressed?: boolean;
  interactive?: boolean;
  fill?: string;
  fillTo?: string;
  border?: number;
  borderColor?: string;
  radius?: number | 'pill';
}

interface PointerState {
  x: number;
  y: number;
  down: boolean;
  justReleased: boolean;
}

interface InputActionState {
  pressed: boolean;
  down: boolean;
}

interface InputMap {
  [action: string]: InputActionState;
}

interface KeyBinding {
  [action: string]: string[];
}

interface UiTheme {
  color: string;
  text: string;
  fontSize: number;
}

interface ListState {
  scroll: number;
}

export class Scene {
  game!: Game;
  input!: SceneInput;

  async setup(_data?: unknown): Promise<void> {
    // Override in scenes.
  }

  update(_dt: number): void {
    // Override in scenes.
  }

  drawHud(_d: Draw): void {
    // Override in scenes.
  }

  gotoTitle(): void {
    this.game.go('title');
  }
}

class SceneInput {
  public keys: InputMap = {};
  private bindings: KeyBinding = {};
  private keyDown = new Set<string>();
  private pressedFrame = new Set<string>();

  bind(map: Record<string, string[]>): void {
    this.bindings = map;
    for (const action of Object.keys(map)) {
      this.keys[action] = { pressed: false, down: false };
    }
  }

  onKeyDown(code: string): void {
    this.keyDown.add(code);
    for (const [action, codes] of Object.entries(this.bindings)) {
      if (codes.includes(code)) {
        this.pressedFrame.add(action);
      }
    }
  }

  onKeyUp(code: string): void {
    this.keyDown.delete(code);
  }

  beginFrame(): void {
    for (const [action, state] of Object.entries(this.keys)) {
      state.pressed = this.pressedFrame.has(action);
      const bound = this.bindings[action] ?? [];
      state.down = bound.some((code) => this.keyDown.has(code));
    }
    this.pressedFrame.clear();
  }
}

class AssetManager {
  async msdfFont(_png: string, _json: string): Promise<MsdfFont> {
    return { family: 'sans-serif' };
  }

  msdfText(font: MsdfFont, text: string, style: MsdfTextStyle): MsdfText {
    return { font, text, style };
  }
}

class UiLayer {
  private draw: Draw;
  private theme: UiTheme = { color: '#20304a', text: '#eef3ff', fontSize: 14 };

  constructor(draw: Draw) {
    this.draw = draw;
  }

  setTheme(_name: string, opts?: { color?: string; text?: string; fontSize?: number }): void {
    if (opts?.color) this.theme.color = opts.color;
    if (opts?.text) this.theme.text = opts.text;
    if (opts?.fontSize) this.theme.fontSize = opts.fontSize;
  }

  setFont(_font: MsdfFont | null): void {
    // No-op in canvas fallback.
  }

  label(x: number, y: number, text: string, opts: DrawTextOpts = {}): void {
    this.draw.drawText(text, x, y, {
      color: opts.color ?? this.theme.text,
      size: opts.size ?? this.theme.fontSize,
      bold: opts.bold,
      align: opts.align,
      wrap: opts.wrap,
    });
  }

  button(x: number, y: number, w: number, h: number, label: string): boolean {
    return this.draw.panel(x, y, w, h, { base: 'glossy', interactive: true }, { label }).clicked;
  }

  select<T extends string>(x: number, y: number, w: number, h: number, current: T, options: readonly T[]): T {
    const state = this.draw.panel(x, y, w, h, { base: 'panel', interactive: true }, { label: String(current) });
    if (!state.clicked || options.length === 0) return current;
    const i = options.indexOf(current);
    return options[(i + 1) % options.length] as T;
  }

  list(
    x: number,
    y: number,
    w: number,
    h: number,
    contentH: number,
    cb: (lx: number, ly: number, lw: number) => void,
  ): void {
    this.draw.panel(x, y, w, h, 'inset');
    const id = `${Math.round(x)}:${Math.round(y)}:${Math.round(w)}:${Math.round(h)}`;
    const listState = this.draw.getListState(id);

    if (this.draw.pointerInRect(x, y, w, h) && this.draw.consumeWheelDelta() !== 0) {
      const wheel = this.draw.lastWheelDelta();
      listState.scroll += wheel * 0.45;
    }

    const maxScroll = Math.max(0, contentH - h);
    listState.scroll = clamp(listState.scroll, 0, maxScroll);

    this.draw.pushClip(x + 1, y + 1, w - 2, h - 2);
    cb(x + 6, y + 6 - listState.scroll, w - 12);
    this.draw.popClip();
  }
}

export class Draw {
  public readonly w: number;
  public readonly h: number;
  public readonly ui: UiLayer;

  private ctx: CanvasRenderingContext2D;
  private pointer: PointerState;
  private game: Game;
  private clipDepth = 0;

  constructor(ctx: CanvasRenderingContext2D, w: number, h: number, pointer: PointerState, game: Game) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.pointer = pointer;
    this.game = game;
    this.ui = new UiLayer(this);
  }

  drawText(text: string, x: number, y: number, opts: DrawTextOpts = {}): void {
    const size = opts.size ?? 14;
    const weight = opts.bold ? '700' : '400';
    this.ctx.font = `${weight} ${size}px sans-serif`;
    this.ctx.textAlign = opts.align ?? 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = opts.color ?? '#ffffff';

    if (!opts.wrap || opts.wrap <= 0) {
      this.ctx.fillText(text, x, y);
      return;
    }

    const words = text.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (this.ctx.measureText(test).width > opts.wrap && line) {
        this.ctx.fillText(line, x, lineY);
        line = word;
        lineY += size + 3;
      } else {
        line = test;
      }
    }
    if (line) this.ctx.fillText(line, x, lineY);
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1, radius = 0): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    if (radius > 0) {
      this.pathRoundRect(x, y, w, h, radius);
      this.ctx.fill();
    } else {
      this.ctx.fillRect(x, y, w, h);
    }
    this.ctx.restore();
  }

  circle(x: number, y: number, r: number, color: string, alpha = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  ring(x: number, y: number, r: number, width: number, color: string, alpha = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  line(x1: number, y1: number, x2: number, y2: number, width: number, color: string, alpha = 1): void {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  poly(points: Array<{ x: number; y: number }>, width: number, color: string, alpha = 1): void {
    if (points.length < 2) return;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) this.ctx.lineTo(points[i].x, points[i].y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  fill(points: Array<{ x: number; y: number }>, color: string, alpha = 1): void {
    if (points.length < 3) return;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) this.ctx.lineTo(points[i].x, points[i].y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  panel(
    x: number,
    y: number,
    w: number,
    h: number,
    style: PanelStyle | 'panel' | 'flat' | 'inset' | 'glossy' | 'bar' = 'panel',
    opts?: { label?: string },
  ): { clicked: boolean; hovered: boolean } {
    const s: PanelStyle = typeof style === 'string' ? { base: style } : style;
    const base = s.base ?? 'panel';
    const radius = s.radius === 'pill' ? Math.min(w, h) / 2 : (s.radius ?? 8);

    const hovered = this.pointerInRect(x, y, w, h);
    const interactive = s.interactive ?? true;
    const clicked = interactive && hovered && this.pointer.justReleased;

    let fill = s.fill ?? '#1f2945';
    let fillTo = s.fillTo ?? '#151d33';
    if (base === 'inset') {
      fill = s.fill ?? '#0e1322';
      fillTo = s.fillTo ?? '#141b2f';
    } else if (base === 'flat') {
      fill = s.fill ?? '#1a2340';
      fillTo = s.fillTo ?? fill;
    } else if (base === 'glossy') {
      fill = s.fill ?? '#2a3a66';
      fillTo = s.fillTo ?? '#1a2544';
    } else if (base === 'bar') {
      fill = s.fill ?? '#38e1ff';
      fillTo = s.fillTo ?? fill;
    }

    if (hovered && (s.hover ?? true)) {
      fill = lighten(fill, 0.06);
      fillTo = lighten(fillTo, 0.04);
    }

    const grad = this.ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, fill);
    grad.addColorStop(1, fillTo);

    this.ctx.save();
    this.pathRoundRect(x, y, w, h, radius);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    const border = s.border ?? 2;
    this.ctx.strokeStyle = s.borderColor ?? '#314777';
    this.ctx.lineWidth = border;
    this.ctx.stroke();
    this.ctx.restore();

    if (opts?.label) {
      this.drawText(opts.label, x + w / 2, y + h / 2 - 9, {
        size: 14,
        bold: true,
        align: 'center',
        color: '#f2f6ff',
      });
    }

    return { clicked, hovered };
  }

  msdfText(text: MsdfText, x: number, y: number, opts?: { origin?: { x?: number; y?: number } }): void {
    const color = typeof text.style.color === 'string'
      ? text.style.color
      : text.style.color?.top ?? '#ffffff';
    this.ctx.save();
    this.ctx.font = `700 ${text.style.fontSize ?? 24}px ${text.font.family}, sans-serif`;
    this.ctx.textAlign = text.style.align ?? 'left';
    this.ctx.textBaseline = 'top';

    const width = this.ctx.measureText(text.text).width;
    const height = text.style.fontSize ?? 24;
    const ox = opts?.origin?.x ?? 0;
    const oy = opts?.origin?.y ?? 0;
    const px = x - width * ox;
    const py = y - height * oy;

    const shadow = text.style.shadow;
    if (shadow) {
      this.ctx.fillStyle = shadow.color ?? '#000000';
      this.ctx.globalAlpha = shadow.alpha ?? 0.4;
      this.ctx.fillText(text.text, px + (shadow.x ?? 0), py + (shadow.y ?? 2));
      this.ctx.globalAlpha = 1;
    }

    const outline = text.style.outline;
    if (outline) {
      this.ctx.lineWidth = Math.max(1, (text.style.fontSize ?? 24) * (outline.width ?? 0.08));
      this.ctx.strokeStyle = outline.color ?? '#000000';
      this.ctx.strokeText(text.text, px, py);
    }

    this.ctx.fillStyle = color;
    this.ctx.fillText(text.text, px, py);
    this.ctx.restore();
  }

  visible(x: number, y: number, w: number, h: number): boolean {
    return x < this.w && y < this.h && x + w > 0 && y + h > 0;
  }

  pointerInRect(x: number, y: number, w: number, h: number): boolean {
    return this.pointer.x >= x && this.pointer.x <= x + w && this.pointer.y >= y && this.pointer.y <= y + h;
  }

  pushClip(x: number, y: number, w: number, h: number): void {
    this.ctx.save();
    this.clipDepth += 1;
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  popClip(): void {
    if (this.clipDepth <= 0) return;
    this.clipDepth -= 1;
    this.ctx.restore();
  }

  consumeWheelDelta(): number {
    return this.game.consumeWheel();
  }

  lastWheelDelta(): number {
    return this.game.lastWheel;
  }

  getListState(id: string): ListState {
    return this.game.getListState(id);
  }

  private pathRoundRect(x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    this.ctx.beginPath();
    this.ctx.moveTo(x + rr, y);
    this.ctx.lineTo(x + w - rr, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    this.ctx.lineTo(x + w, y + h - rr);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    this.ctx.lineTo(x + rr, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    this.ctx.lineTo(x, y + rr);
    this.ctx.quadraticCurveTo(x, y, x + rr, y);
    this.ctx.closePath();
  }
}

export class Game {
  public readonly hud: { ui: UiLayer };
  public readonly assets: AssetManager;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pointer: PointerState = { x: -1, y: -1, down: false, justReleased: false };
  private readonly input = new SceneInput();
  private readonly scenes: Record<string, SceneCtor>;
  private currentScene: Scene | null = null;
  private currentSceneKey = '';
  private running = false;
  private lastTs = 0;
  private pendingGo: Promise<void> = Promise.resolve();
  private listStates = new Map<string, ListState>();
  public lastWheel = 0;
  private hasWheel = false;

  private constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, scenes: Record<string, SceneCtor>, bg: string) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scenes = scenes;
    this.assets = new AssetManager();
    const draw = new Draw(this.ctx, this.canvas.width, this.canvas.height, this.pointer, this);
    this.hud = { ui: draw.ui };
    this.canvas.style.background = bg;
    this.bindDomEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  static async create(options: GameOptions = {}): Promise<Game> {
    const host = findHost(options.container ?? '#game');
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.innerHTML = '';
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    if (options.pixelArt) {
      ctx.imageSmoothingEnabled = false;
      canvas.style.imageRendering = 'pixelated';
    }

    const game = new Game(canvas, ctx, options.scenes ?? {}, options.background ?? '#0b0e1a');
    const initial = Object.keys(options.scenes ?? {})[0];
    if (!initial) throw new Error('No scenes registered');
    await game.go(initial);
    return game;
  }

  async go(sceneKey: string, data?: unknown): Promise<void> {
    this.pendingGo = this.pendingGo.then(async () => {
      const Ctor = this.scenes[sceneKey];
      if (!Ctor) throw new Error(`Unknown scene: ${sceneKey}`);
      const scene = new Ctor();
      scene.game = this;
      scene.input = this.input;
      this.currentSceneKey = sceneKey;
      this.currentScene = scene;
      await scene.setup(data);
    });
    await this.pendingGo;
  }

  run(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    requestAnimationFrame((ts) => this.tick(ts));
  }

  private tick(ts: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;

    this.input.beginFrame();
    if (this.currentScene) {
      this.currentScene.update(dt);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const draw = new Draw(this.ctx, this.canvas.width, this.canvas.height, this.pointer, this);
      this.hud.ui = draw.ui;
      this.currentScene.drawHud(draw);
    }

    this.pointer.justReleased = false;
    this.hasWheel = false;
    this.lastWheel = 0;

    requestAnimationFrame((next) => this.tick(next));
  }

  private bindDomEvents(): void {
    const mapPos = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / Math.max(1, rect.width);
      const sy = this.canvas.height / Math.max(1, rect.height);
      this.pointer.x = (clientX - rect.left) * sx;
      this.pointer.y = (clientY - rect.top) * sy;
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      mapPos(e.clientX, e.clientY);
      this.pointer.down = true;
    });

    this.canvas.addEventListener('pointermove', (e) => {
      mapPos(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      mapPos(e.clientX, e.clientY);
      this.pointer.down = false;
      this.pointer.justReleased = true;
    });

    this.canvas.addEventListener('wheel', (e) => {
      this.hasWheel = true;
      this.lastWheel = e.deltaY;
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', (e) => this.input.onKeyDown(normalizeKeyCode(e)));
    window.addEventListener('keyup', (e) => this.input.onKeyUp(normalizeKeyCode(e)));
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  getListState(id: string): ListState {
    if (!this.listStates.has(id)) this.listStates.set(id, { scroll: 0 });
    return this.listStates.get(id)!;
  }

  consumeWheel(): number {
    return this.hasWheel ? 1 : 0;
  }
}

function findHost(selector: string): HTMLElement {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Mount container not found: ${selector}`);
  }
  return node;
}

function normalizeKeyCode(ev: KeyboardEvent): string {
  if (ev.code && ev.code.startsWith('Key')) return ev.code.slice(3);
  if (ev.code && ev.code.startsWith('Digit')) return ev.code.slice(5);
  return ev.code || ev.key;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lighten(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (!/^([0-9a-fA-F]{6})$/.test(h)) return hex;
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.round(clamp(r + amount * 255, 0, 255));
  g = Math.round(clamp(g + amount * 255, 0, 255));
  b = Math.round(clamp(b + amount * 255, 0, 255));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
