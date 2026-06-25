import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDimensions, parseRequest, MAX_SIZE, BadRequest } from '../lib/parse.js';

test('parses WxH', () => {
  assert.deepEqual(parseDimensions('200x300'), { width: 200, height: 300 });
});

test('parses square shorthand N', () => {
  assert.deepEqual(parseDimensions('200'), { width: 200, height: 200 });
});

test('clamps to MAX_SIZE', () => {
  assert.deepEqual(parseDimensions('99999x10'), { width: MAX_SIZE, height: 10 });
});

test('rejects garbage with BadRequest', () => {
  assert.throws(() => parseDimensions('abc'), BadRequest);
  assert.throws(() => parseDimensions('200x'), BadRequest);
  assert.throws(() => parseDimensions(''), BadRequest);
  assert.throws(() => parseDimensions('0'), BadRequest);
});

test('parseRequest reads dim from query (rewrite) and seed/contrast', () => {
  const r = parseRequest('/api/render?dim=200x200&seed=foo&contrast=complementary');
  assert.equal(r.width, 200);
  assert.equal(r.height, 200);
  assert.equal(r.seed, 'foo');
  assert.equal(r.contrast, 'complementary');
});

test('parseRequest reads dim from path when hit directly', () => {
  const r = parseRequest('/640x480');
  assert.equal(r.width, 640);
  assert.equal(r.height, 480);
});

test('seed defaults to size, invalid contrast ignored', () => {
  const r = parseRequest('/100?contrast=bogus');
  assert.equal(r.seed, '100x100');
  assert.equal(r.contrast, undefined);
});
