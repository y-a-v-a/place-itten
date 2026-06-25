// lib/render.js
// Draw a Bauhaus-style geometric composition from an Itten palette and encode
// it to a PNG Buffer with pureimage (pure-JS, no native deps).

import { Writable } from 'node:stream';
import * as PImage from 'pureimage';
import { makeRng } from './itten.js';

// Collect a writable stream's chunks into a single Buffer.
function bufferSink() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  stream.toBuffer = () => Buffer.concat(chunks);
  return stream;
}

const sum = (a) => a.reduce((x, y) => x + y, 0);

// Weighted bands along one axis — the canonical "two-or-more colour fields"
// layout, and the one that honours area ratios (the extension contrast).
function splitWeighted(ctx, w, h, colors, weights, horizontal) {
  const total = sum(weights);
  const axis = horizontal ? w : h;
  let pos = 0;
  for (let i = 0; i < colors.length; i++) {
    const len = i === colors.length - 1 ? axis - pos : Math.round((axis * weights[i]) / total);
    ctx.fillStyle = colors[i];
    if (horizontal) ctx.fillRect(pos, 0, len, h);
    else ctx.fillRect(0, pos, w, len);
    pos += len;
  }
}

// Many equal stripes cycling through the palette.
function bands(ctx, w, h, colors, rng) {
  const horizontal = rng.chance(0.5);
  const count = rng.int(colors.length, colors.length + 4);
  const axis = horizontal ? h : w;
  let pos = 0;
  for (let i = 0; i < count; i++) {
    const len = i === count - 1 ? axis - pos : Math.round(axis / count);
    ctx.fillStyle = colors[i % colors.length];
    if (horizontal) ctx.fillRect(0, pos, w, len);
    else ctx.fillRect(pos, 0, len, h);
    pos += len;
  }
}

// Mondrian-ish grid of colour blocks.
function blocks(ctx, w, h, colors, rng) {
  const cols = rng.int(2, 4);
  const rows = rng.int(2, 4);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round((c * w) / cols);
      const y = Math.round((r * h) / rows);
      const x2 = Math.round(((c + 1) * w) / cols);
      const y2 = Math.round(((r + 1) * h) / rows);
      ctx.fillStyle = colors[rng.int(0, colors.length - 1)];
      ctx.fillRect(x, y, x2 - x, y2 - y);
    }
  }
}

function fillTriangle(ctx, color, p0, p1, p2) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.closePath();
  ctx.fill();
}

function fillCircle(ctx, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

// A diagonal split into two triangles, with an optional circle accent.
function diagonal(ctx, w, h, colors, rng) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  const corner = rng.int(0, 1);
  if (corner === 0) {
    fillTriangle(ctx, colors[1 % colors.length], [0, 0], [w, 0], [0, h]);
  } else {
    fillTriangle(ctx, colors[1 % colors.length], [w, 0], [w, h], [0, h]);
  }
  if (colors.length > 2) {
    fillCircle(ctx, colors[2], w / 2, h / 2, Math.min(w, h) * 0.18);
  }
}

// A solid field with a few large primitives floating on top.
function shapes(ctx, w, h, colors, rng) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  const base = Math.min(w, h);
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const color = colors[rng.int(Math.min(1, colors.length - 1), colors.length - 1)];
    const size = rng.range(base * 0.25, base * 0.6);
    const cx = rng.range(0, w);
    const cy = rng.range(0, h);
    const kind = rng.int(0, 2);
    if (kind === 0) {
      fillCircle(ctx, color, cx, cy, size / 2);
    } else if (kind === 1) {
      ctx.fillStyle = color;
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    } else {
      fillTriangle(
        ctx,
        color,
        [cx, cy - size / 2],
        [cx + size / 2, cy + size / 2],
        [cx - size / 2, cy + size / 2],
      );
    }
  }
}

// Choose and execute a layout. The extension contrast always uses the
// weighted split so Itten's area ratios are visible.
function compose(ctx, w, h, palette, rng) {
  const { colors, weights, contrast } = palette;

  if (contrast === 'extension') {
    splitWeighted(ctx, w, h, colors, weights, rng.chance(0.5));
    return;
  }

  const templates = ['split', 'bands', 'blocks', 'diagonal', 'shapes'];
  const choice = rng.pick(templates);
  switch (choice) {
    case 'bands':
      return bands(ctx, w, h, colors, rng);
    case 'blocks':
      return blocks(ctx, w, h, colors, rng);
    case 'diagonal':
      return diagonal(ctx, w, h, colors, rng);
    case 'shapes':
      return shapes(ctx, w, h, colors, rng);
    case 'split':
    default:
      return splitWeighted(ctx, w, h, colors, weights, rng.chance(0.5));
  }
}

// render({ width, height, palette, seed }) -> Promise<Buffer> (a PNG).
export async function render({ width, height, palette, seed }) {
  const img = PImage.make(width, height);
  const ctx = img.getContext('2d');

  // Layout uses its own rng stream so palette choice and layout choice are
  // independent yet both deterministic for a given seed.
  const rng = makeRng(`${seed}|layout`);
  compose(ctx, width, height, palette, rng);

  const sink = bufferSink();
  await PImage.encodePNGToStream(img, sink);
  return sink.toBuffer();
}
