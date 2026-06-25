import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../lib/render.js';
import { pickPalette } from '../lib/itten.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// PNG stores width/height as big-endian uint32 at bytes 16 and 20 (in IHDR).
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('render returns a PNG buffer of the requested size', async () => {
  const palette = pickPalette('200x200');
  const png = await render({ width: 200, height: 120, palette, seed: '200x200' });
  assert.ok(Buffer.isBuffer(png));
  assert.ok(png.subarray(0, 8).equals(PNG_MAGIC), 'has PNG magic bytes');
  assert.deepEqual(pngSize(png), { width: 200, height: 120 });
});

test('render is deterministic for the same seed', async () => {
  const palette = pickPalette('repeat', 'complementary');
  const a = await render({ width: 64, height: 64, palette, seed: 'repeat' });
  const b = await render({ width: 64, height: 64, palette, seed: 'repeat' });
  assert.ok(a.equals(b), 'identical inputs produce byte-identical PNGs');
});

test('every contrast renders without throwing', async () => {
  for (const c of ['hue', 'light-dark', 'cold-warm', 'complementary', 'simultaneous', 'saturation', 'extension']) {
    const palette = pickPalette('s', c);
    const png = await render({ width: 80, height: 50, palette, seed: 's' });
    assert.deepEqual(pngSize(png), { width: 80, height: 50 });
  }
});
