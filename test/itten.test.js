import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPalette, CONTRASTS, ITTEN_WHEEL } from '../lib/itten.js';

test('wheel has 12 hues with valid hex', () => {
  assert.equal(ITTEN_WHEEL.length, 12);
  for (const h of ITTEN_WHEEL) {
    assert.match(h.hex, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('pickPalette is deterministic for a seed', () => {
  const a = pickPalette('itten');
  const b = pickPalette('itten');
  assert.deepEqual(a, b);
});

test('different seeds generally differ', () => {
  const a = pickPalette('alpha');
  const b = pickPalette('omega');
  // Not a hard guarantee, but these two seeds must not collide on everything.
  assert.notDeepEqual(a, b);
});

test('forced contrast is honoured and produces >=2 colours', () => {
  for (const c of CONTRASTS) {
    const p = pickPalette('seed-' + c, c);
    assert.equal(p.contrast, c);
    assert.ok(p.colors.length >= 2, `${c} should yield at least 2 colours`);
    assert.equal(p.colors.length, p.weights.length);
    for (const hex of p.colors) assert.match(hex, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('invalid forced contrast falls back to a real one', () => {
  const p = pickPalette('x', 'not-a-contrast');
  assert.ok(CONTRASTS.includes(p.contrast));
});

test('extension contrast uses unequal weights (Itten area ratios)', () => {
  const p = pickPalette('ratio', 'extension');
  assert.notEqual(p.weights[0], p.weights[1]);
});
