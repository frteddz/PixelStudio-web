import { PixelEditor } from './app';
import { ToolType } from './tools';
import './style.css';

const canvas = document.getElementById('editorCanvas') as HTMLCanvasElement | null;
const preview = document.getElementById('previewCanvas') as HTMLCanvasElement | null;
if (!canvas || !preview) throw new Error('Required elements missing');

const editor = new PixelEditor(canvas, preview);

const PALETTE = [
  '#FF0000', '#FF6600', '#FFCC00', '#FFFF00',
  '#66FF00', '#00FF00', '#00FF66', '#00FFCC',
  '#00CCFF', '#0066FF', '#0000FF', '#6600FF',
  '#CC00FF', '#FF00FF', '#FF0066', '#FF3366',
  '#FFFFFF', '#CCCCCC', '#999999', '#666666',
  '#333333', '#111111', '#FFD700', '#DAA520',
];

const paletteEl = document.getElementById('palette')!;
let firstColor: HTMLButtonElement | null = null;
for (const color of PALETTE) {
  const btn = document.createElement('button');
  btn.className = 'palette-color';
  btn.dataset.color = color;
  btn.style.background = color;
  if (color === '#FFFFFF' || color === '#FFCC00' || color === '#FFFF00') {
    btn.style.border = '1px solid #555';
  }
  btn.addEventListener('click', () => {
    editor.setColor(color);
    document.querySelectorAll('.palette-color').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const ci = document.getElementById('colorIndicator')!;
    ci.style.background = color;
  });
  if (!firstColor) firstColor = btn;
  paletteEl.appendChild(btn);
}
firstColor?.click();

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    editor.setTool((btn as HTMLElement).dataset.tool as ToolType);
  });
});

document.getElementById('undoBtn')!.addEventListener('click', () => editor.undo());
document.getElementById('clearBtn')!.addEventListener('click', () => editor.clear());
document.getElementById('exportBtn')!.addEventListener('click', () => editor.exportPNG());
