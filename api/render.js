// api/render.js
// Vercel Node serverless function. Parses the request, builds an Itten
// palette, renders a PNG, and streams it back with long-lived cache headers
// (output is fully deterministic for a given URL).

import { parseRequest, BadRequest } from '../lib/parse.js';
import { pickPalette } from '../lib/itten.js';
import { render } from '../lib/render.js';

export default async function handler(req, res) {
  try {
    const { width, height, seed, contrast } = parseRequest(req.url);
    const palette = pickPalette(seed, contrast);
    const png = await render({ width, height, palette, seed });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Helpful for debugging which contrast/palette was chosen.
    res.setHeader('X-Itten-Contrast', palette.contrast);
    res.end(png);
  } catch (err) {
    const status = err instanceof BadRequest ? err.statusCode : 500;
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(status === 400 ? err.message : 'Internal error while generating image.');
  }
}
