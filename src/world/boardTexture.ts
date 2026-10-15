import { CanvasTexture, SRGBColorSpace } from 'three/webgpu';

const WIDTH = 1536;
const HEIGHT = 800;
const MARGIN = 160;

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
      if (ctx.measureText(line).width > width) {
        const chars = Array.from(line);
        line = '';
        for (const char of chars) {
          if (line && ctx.measureText(line + char).width > width) {
            lines.push(line);
            line = char;
          } else line += char;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

export function createBoardTexture(id: number, text: string, anisotropy: number, collected: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2a1f1a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#b68b59';
  ctx.lineWidth = 12;
  ctx.strokeRect(26, 26, WIDTH - 52, HEIGHT - 52);
  ctx.strokeStyle = '#55402f';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, WIDTH - 96, HEIGHT - 96);
  ctx.fillStyle = '#f0d29a';
  ctx.font = '600 30px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Thông điệp', WIDTH / 2, 76);

  let fontSize = 64;
  let lines: string[] = [];
  const maxWidth = WIDTH - MARGIN * 2;
  const maxHeight = HEIGHT - MARGIN * 2 - 48;
  while (true) {
    ctx.font = `600 ${fontSize}px "Be Vietnam Pro", sans-serif`;
    lines = wrapText(ctx, text, maxWidth);
    if (lines.length * fontSize * 1.4 <= maxHeight || fontSize === 30) break;
    fontSize = Math.max(30, fontSize - 4);
  }
  ctx.font = `600 ${fontSize}px "Be Vietnam Pro", sans-serif`;
  if (lines.length * fontSize * 1.4 > maxHeight) {
    lines.length = Math.floor(maxHeight / (fontSize * 1.4));
    let last = lines.at(-1) ?? '';
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = Array.from(last).slice(0, -1).join('');
    if (lines.length) lines[lines.length - 1] = `${last}…`;
    console.warn(`Board message ${id} was shortened to fit the panel.`);
  }

  ctx.fillStyle = '#fff4dc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lineHeight = fontSize * 1.4;
  const y = MARGIN + 40 + (maxHeight - lines.length * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, MARGIN, y + i * lineHeight));

  if (collected) {
    ctx.strokeStyle = '#a9cc78';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(WIDTH - 240, 88);
    ctx.lineTo(WIDTH - 210, 118);
    ctx.lineTo(WIDTH - 160, 62);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}
