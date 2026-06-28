// lib/itten.js
// Johannes Itten's color theory, distilled into data + palette generators.
//
//  - ITTEN_WHEEL: the 12-hue color wheel (Farbkreis).
//  - A small seeded PRNG (xmur3 -> mulberry32) so a given seed string always
//    yields the same palette.
//  - One generator per each of Itten's 7 color contrasts. Each returns
//    `{ colors: [hex...], weights: [number...] }`.
//  - pickPalette(seed, forcedContrast?) ties it together.

// ---------------------------------------------------------------------------
// The 12-hue wheel. Index i and (i + 6) % 12 are complementaries.
// Indices 0..5 are the warm half (yellow -> red-violet),
// indices 6..11 the cool half (violet -> yellow-green).
// ---------------------------------------------------------------------------
export const ITTEN_WHEEL = [
  { name: 'yellow', hex: '#F7D417', light: 9 },
  { name: 'yellow-orange', hex: '#F59B00', light: 8 },
  { name: 'orange', hex: '#ED6A00', light: 8 },
  { name: 'red-orange', hex: '#E1470E', light: 7 },
  { name: 'red', hex: '#BE1E2D', light: 6 },
  { name: 'red-violet', hex: '#A2195B', light: 4 },
  { name: 'violet', hex: '#652D86', light: 3 },
  { name: 'blue-violet', hex: '#2E3192', light: 4 },
  { name: 'blue', hex: '#0061A8', light: 4 },
  { name: 'blue-green', hex: '#00A19A', light: 5 },
  { name: 'green', hex: '#00A651', light: 6 },
  { name: 'yellow-green', hex: '#8CC63F', light: 7 },
];

export const WHEEL_SIZE = ITTEN_WHEEL.length; // 12

export const CONTRASTS = [
  'hue',
  'light-dark',
  'cold-warm',
  'complementary',
  'simultaneous',
  'saturation',
  'extension',
];

// ---------------------------------------------------------------------------
// Seeded PRNG. xmur3 hashes a string into a 32-bit seed; mulberry32 turns
// that seed into a deterministic stream of floats in [0, 1).
// (Both are well-known public-domain snippets.)
// ---------------------------------------------------------------------------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a small rng helper object seeded deterministically from `seed`.
export function makeRng(seed) {
  const next = mulberry32(xmur3(String(seed))());
  return {
    next,
    // float in [min, max)
    range: (min, max) => min + next() * (max - min),
    // integer in [min, max] inclusive
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

// ---------------------------------------------------------------------------
// Color maths. We work in RGB and produce hex strings for the renderer.
// ---------------------------------------------------------------------------
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

export function rgbToHex({ r, g, b }) {
  const h = (v) => clamp255(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

const lighten = (hex, t) => rgbToHex(mix(hexToRgb(hex), WHITE, t));
const darken = (hex, t) => rgbToHex(mix(hexToRgb(hex), BLACK, t));

// Perceptual gray of a color (Rec. 601 luma).
function grayOf(rgb) {
  const y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return { r: y, g: y, b: y };
}

const desaturate = (hex, t) => rgbToHex(mix(hexToRgb(hex), grayOf(hexToRgb(hex)), t));

const complementIndex = (i) => (i + 6) % WHEEL_SIZE;
const isWarm = (i) => i < 6;

// ---------------------------------------------------------------------------
// The 7 contrast generators. Each consumes the rng and returns a palette.
// ---------------------------------------------------------------------------
const generators = {
  // 1. Contrast of hue (Farbe-an-sich): several pure, undiluted hues set apart
  // on the wheel. We use an evenly spaced triad for maximum hue contrast.
  hue(rng) {
    const start = rng.int(0, WHEEL_SIZE - 1);
    const idx = [start, (start + 4) % WHEEL_SIZE, (start + 8) % WHEEL_SIZE];
    return {
      colors: idx.map((i) => ITTEN_WHEEL[i].hex),
      weights: [1, 1, 1],
    };
  },

  // 2. Light-dark contrast: a single hue stepped from tint to shade.
  'light-dark'(rng) {
    const base = ITTEN_WHEEL[rng.int(0, WHEEL_SIZE - 1)].hex;
    return {
      colors: [lighten(base, 0.6), lighten(base, 0.25), base, darken(base, 0.35), darken(base, 0.6)],
      weights: [1, 1, 1, 1, 1],
    };
  },

  // 3. Cold-warm contrast: a warm hue against a cool one.
  'cold-warm'(rng) {
    const warm = ITTEN_WHEEL[rng.int(0, 5)].hex;
    const cool = ITTEN_WHEEL[rng.int(6, 11)].hex;
    return { colors: [warm, cool], weights: [1, 1] };
  },

  // 4. Complementary contrast: a hue and its opposite on the wheel.
  complementary(rng) {
    const i = rng.int(0, WHEEL_SIZE - 1);
    return {
      colors: [ITTEN_WHEEL[i].hex, ITTEN_WHEEL[complementIndex(i)].hex],
      weights: [1, 1],
    };
  },

  // 5. Simultaneous contrast: a vivid hue beside a neutral gray nudged toward
  // its complement (the gray then appears to shimmer with that complement).
  simultaneous(rng) {
    const i = rng.int(0, WHEEL_SIZE - 1);
    const vivid = ITTEN_WHEEL[i].hex;
    const compRgb = hexToRgb(ITTEN_WHEEL[complementIndex(i)].hex);
    const gray = rgbToHex(mix({ r: 128, g: 128, b: 128 }, compRgb, 0.12));
    return { colors: [vivid, gray], weights: [1, 2] };
  },

  // 6. Saturation contrast: one hue, vivid versus muted.
  saturation(rng) {
    const base = ITTEN_WHEEL[rng.int(0, WHEEL_SIZE - 1)].hex;
    return { colors: [base, desaturate(base, 0.7)], weights: [1, 1] };
  },

  // 7. Contrast of extension (quantity): a complementary pair in Itten's
  // harmonious area ratios, derived from each hue's light value (brighter
  // colors occupy proportionally smaller areas).
  extension(rng) {
    const i = rng.int(0, WHEEL_SIZE - 1);
    const j = complementIndex(i);
    const a = ITTEN_WHEEL[i];
    const b = ITTEN_WHEEL[j];
    return {
      colors: [a.hex, b.hex],
      weights: [1 / a.light, 1 / b.light],
    };
  },
};

// ---------------------------------------------------------------------------
// pickPalette: choose (or honor) a contrast and build its palette.
// Deterministic for a given (seed, forcedContrast).
// ---------------------------------------------------------------------------
export function pickPalette(seed, forcedContrast) {
  const rng = makeRng(seed);
  const contrast = CONTRASTS.includes(forcedContrast) ? forcedContrast : rng.pick(CONTRASTS);
  const { colors, weights } = generators[contrast](rng);
  return { seed: String(seed), contrast, colors, weights };
}
