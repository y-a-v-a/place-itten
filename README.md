# Place Itten

Placeholder images for mockups — generated on the fly from **Johannes Itten's
colour theory**. A spiritual successor to the late placekitten, swapping cats
for the Bauhaus.

A request like:

```
GET https://www.placeitten.org/200x200
```

returns a 200×200 PNG composed from two or more colours drawn from Itten's
**12-hue colour wheel** and one of his **seven colour contrasts**, laid out as a
Bauhaus-style geometric composition. Everything is generated per-request in pure
JavaScript — no image assets are stored.

## Routes

| URL | Result |
| --- | --- |
| `/200x300` | a 200×300 PNG |
| `/200` | shorthand for a 200×200 square |
| `/200x200?seed=anything` | a different palette; the **same seed always returns the same image** |
| `/200x200?contrast=complementary` | force a specific Itten contrast |

Valid `contrast` values: `hue`, `light-dark`, `cold-warm`, `complementary`,
`simultaneous`, `saturation`, `extension`.

Dimensions are clamped to 1–1500px per side. The response carries
`Cache-Control: public, max-age=31536000, immutable` (output is deterministic
for a given URL) and an `X-Itten-Contrast` header noting the chosen contrast.

## The colour theory

- **12-hue wheel** (`lib/itten.js` → `ITTEN_WHEEL`): the Farbkreis, where hue
  `i` and `(i + 6) % 12` are complementaries; indices 0–5 are the warm half,
  6–11 the cool half.
- **Seven contrasts**, one generator each: contrast of *hue*, *light-dark*,
  *cold-warm*, *complementary*, *simultaneous*, *saturation*, and *extension*
  (the last uses each hue's light value to set harmonious area ratios).

A seed (the `?seed` value, or the dimensions when none is given) is hashed into a
deterministic PRNG that chooses the contrast, the hues, and the layout.

## How it's built

- **Runtime:** Vercel Node.js serverless functions (`api/render.js`).
- **Image generation:** [`pureimage`](https://www.npmjs.com/package/pureimage) —
  a pure-JS Canvas2D + PNG encoder, so there are no native dependencies.
- **Routing:** `vercel.json` rewrites numeric paths to the function; `/` serves
  the static homepage in `public/`.

```
api/render.js     Vercel handler: parse → palette → render → stream PNG
lib/itten.js      wheel data, seeded RNG, the 7 contrast generators
lib/render.js     geometric composition + PNG encoding
lib/parse.js      URL/dimension parsing & validation
public/index.html homepage with live examples
test/             node:test unit tests
```

## Develop

```sh
npm install
npm test          # node --test
npm run dev       # vercel dev  (needs the Vercel CLI)
```

Then open <http://localhost:3000/> for the gallery, or hit
<http://localhost:3000/200x200> directly.

## Deploy

Deploy to Vercel and point the `placeitten.org` domain at the project. No build
step or environment variables are required.

---

Named after **Johannes Itten** (1888–1967), Bauhaus master and author of
*The Art of Color*.
