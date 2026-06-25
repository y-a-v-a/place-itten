// lib/parse.js
// Parse an incoming request into { width, height, seed, contrast }.
// Accepts both "WxH" (e.g. 200x200) and "N" (e.g. 200 -> 200x200).

import { CONTRASTS } from './itten.js';

export const MAX_SIZE = 1500;
export const MIN_SIZE = 1;

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequest';
    this.statusCode = 400;
  }
}

const clamp = (n) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));

// "200x200" | "200" -> { width, height }. Throws BadRequest on garbage.
export function parseDimensions(dim) {
  const m = /^(\d+)(?:x(\d+))?$/i.exec(String(dim ?? '').trim());
  if (!m) {
    throw new BadRequest(`Invalid dimensions: "${dim}". Use /WIDTHxHEIGHT (e.g. /200x300) or /SIZE (e.g. /200).`);
  }
  const width = parseInt(m[1], 10);
  const height = m[2] !== undefined ? parseInt(m[2], 10) : width;
  if (width < MIN_SIZE || height < MIN_SIZE) {
    throw new BadRequest('Dimensions must be at least 1px.');
  }
  return { width: clamp(width), height: clamp(height) };
}

// Parse a request URL (path + query) into everything render needs.
// `dim` may arrive as a query param (via the Vercel rewrite) or as the
// last path segment (when the function is hit directly).
export function parseRequest(reqUrl) {
  const url = new URL(reqUrl, 'http://placeitten.local');
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments.length ? decodeURIComponent(segments[segments.length - 1]) : '';
  const dim = url.searchParams.get('dim') ?? last;

  const { width, height } = parseDimensions(dim);

  const seed = url.searchParams.get('seed') ?? `${width}x${height}`;

  const requested = url.searchParams.get('contrast');
  const contrast = requested && CONTRASTS.includes(requested) ? requested : undefined;

  return { width, height, seed, contrast };
}
