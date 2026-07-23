import { ToolType, hexToRgba, bresenhamLine } from './tools';

const GRID = 32;
const MAX_UNDO = 20;

export class PixelEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private preview: HTMLCanvasElement;
  private previewCtx: CanvasRenderingContext2D;
  private data: Uint8ClampedArray;
  private undoStack: Uint8ClampedArray[] = [];
  private tool: ToolType = 'pen';
  private color: string = '#FFFFFF';
  private drawing = false;
  private lastX = -1;
  private lastY = -1;
  private zoom = 16;

  private handleResizeBound: () => void;

  constructor(canvas: HTMLCanvasElement, preview: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.preview = preview;
    this.previewCtx = preview.getContext('2d')!;

    const len = GRID * GRID * 4;
    this.data = new Uint8ClampedArray(len);
    this.data.fill(0);

    this.handleResizeBound = () => this.handleResize();
    this.handleResize();
    this.setupEvents();
    this.render();
  }

  private pixelIndex(x: number, y: number): number {
    return (y * GRID + x) * 4;
  }

  private getR(x: number, y: number): number { return this.data[this.pixelIndex(x, y)]; }
  private getG(x: number, y: number): number { return this.data[this.pixelIndex(x, y) + 1]; }
  private getB(x: number, y: number): number { return this.data[this.pixelIndex(x, y) + 2]; }
  private getA(x: number, y: number): number { return this.data[this.pixelIndex(x, y) + 3]; }

  private setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
    const i = this.pixelIndex(x, y);
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < GRID && y >= 0 && y < GRID;
  }

  private handleResize(): void {
    const parent = this.canvas.parentElement!;
    const maxW = Math.min(parent.clientWidth - 32, 600);
    const maxH = parent.clientHeight - 32;
    this.zoom = Math.max(4, Math.floor(Math.min(maxW / GRID, maxH / GRID)));
    this.canvas.width = GRID * this.zoom;
    this.canvas.height = GRID * this.zoom;
    this.render();
  }

  private setupEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', () => this.onPointerUp());
    this.canvas.addEventListener('pointerleave', () => this.onPointerUp());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'p' || e.key === 'P') this.setTool('pen');
        else if (e.key === 'g' || e.key === 'G') this.setTool('fill');
        else if (e.key === 'e' || e.key === 'E') this.setTool('eraser');
      }
    });

    window.addEventListener('resize', this.handleResizeBound);
  }

  saveState(): void {
    this.undoStack.push(new Uint8ClampedArray(this.data));
    if (this.undoStack.length > MAX_UNDO) {
      this.undoStack.shift();
    }
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    this.data.set(this.undoStack.pop()!);
    this.render();
  }

  clear(): void {
    this.saveState();
    this.data.fill(0);
    this.render();
  }

  setTool(tool: ToolType): void {
    this.tool = tool;
  }

  setColor(color: string): void {
    this.color = color;
  }

  private render(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const imageData = new ImageData(
      new Uint8ClampedArray(this.data),
      GRID,
      GRID,
    );

    const temp = document.createElement('canvas');
    temp.width = GRID;
    temp.height = GRID;
    const tc = temp.getContext('2d')!;
    tc.putImageData(imageData, 0, 0);

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(temp, 0, 0, w, h);

    if (this.zoom >= 8) {
      this.ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      this.ctx.lineWidth = 0.5;
      for (let x = 0; x <= GRID; x++) {
        this.ctx.beginPath();
        this.ctx.moveTo(x * this.zoom + 0.5, 0);
        this.ctx.lineTo(x * this.zoom + 0.5, h);
        this.ctx.stroke();
      }
      for (let y = 0; y <= GRID; y++) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y * this.zoom + 0.5);
        this.ctx.lineTo(w, y * this.zoom + 0.5);
        this.ctx.stroke();
      }
    }

    this.previewCtx.clearRect(0, 0, this.preview.width, this.preview.height);
    this.previewCtx.imageSmoothingEnabled = false;
    tc.imageSmoothingEnabled = false;
    this.previewCtx.drawImage(temp, 0, 0, this.preview.width, this.preview.height);
  }

  private gridPos(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);
    return [x, y];
  }

  private drawPixel(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    if (this.tool === 'pen') {
      const [r, g, b] = hexToRgba(this.color);
      this.setPixel(x, y, r, g, b, 255);
    } else if (this.tool === 'eraser') {
      this.setPixel(x, y, 0, 0, 0, 0);
    }
  }

  private floodFill(sx: number, sy: number): void {
    if (!this.inBounds(sx, sy)) return;

    const tr = this.getR(sx, sy);
    const tg = this.getG(sx, sy);
    const tb = this.getB(sx, sy);
    const ta = this.getA(sx, sy);

    const [fr, fg, fb] = hexToRgba(this.color);
    const fa = 255;

    if (tr === fr && tg === fg && tb === fb && ta === fa) return;

    const stack: [number, number][] = [[sx, sy]];
    const visited = new Uint8Array(GRID * GRID);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = y * GRID + x;
      if (!this.inBounds(x, y)) continue;
      if (visited[key]) continue;
      if (
        this.getR(x, y) !== tr ||
        this.getG(x, y) !== tg ||
        this.getB(x, y) !== tb ||
        this.getA(x, y) !== ta
      ) continue;

      visited[key] = 1;
      this.setPixel(x, y, fr, fg, fb, fa);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 2) {
      this.saveState();
      const [x, y] = this.gridPos(e);
      this.setPixel(x, y, 0, 0, 0, 0);
      this.render();
      return;
    }
    this.saveState();
    const [x, y] = this.gridPos(e);
    if (this.tool === 'fill') {
      this.floodFill(x, y);
      this.render();
      return;
    }
    this.drawing = true;
    this.lastX = x;
    this.lastY = y;
    this.drawPixel(x, y);
    this.render();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drawing) return;
    const [x, y] = this.gridPos(e);
    if (x === this.lastX && y === this.lastY) return;
    const lx = this.lastX;
    const ly = this.lastY;
    this.lastX = x;
    this.lastY = y;
    if (this.tool === 'pen' || this.tool === 'eraser') {
      bresenhamLine(lx, ly, x, y, (px, py) => this.drawPixel(px, py));
    }
    this.render();
  }

  private onPointerUp(): void {
    this.drawing = false;
    this.lastX = -1;
    this.lastY = -1;
  }

  exportPNG(): void {
    const temp = document.createElement('canvas');
    temp.width = GRID;
    temp.height = GRID;
    const tc = temp.getContext('2d')!;
    const imageData = new ImageData(new Uint8ClampedArray(this.data), GRID, GRID);
    tc.putImageData(imageData, 0, 0);
    temp.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pixel-art.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResizeBound);
  }
}
