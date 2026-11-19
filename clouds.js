// Procedural clouds, generated once per layer (no image files, nothing regenerated per time of day):
//   mask  - white + alpha cloud density (seamless horizontally) -> CSS mask, so --cloud-tint can recolour it
//   shade - opaque grey lighting (bright tops, grey undersides)  -> multiplied with the tint via CSS
// Density: periodic Perlin fBm with domain warping (billowy cumulus shapes, wispy edges).

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrap = (i, n) => ((i % n) + n) % n;
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

// Periodic gradient-noise lattice with cx x cy cells (wraps in both axes).
function makeLattice(cx, cy, rnd) {
  const gx = new Float32Array(cx * cy);
  const gy = new Float32Array(cx * cy);
  for (let i = 0; i < gx.length; i++) {
    const a = rnd() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  return { cx, cy, gx, gy };
}

// u, v are in lattice units (may lie outside [0, cx) / [0, cy): the lattice wraps).
function perlin(l, u, v) {
  const { cx, cy, gx, gy } = l;
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fx = u - iu;
  const fy = v - iv;
  const x0 = wrap(iu, cx);
  const x1 = x0 + 1 === cx ? 0 : x0 + 1;
  const y0 = wrap(iv, cy) * cx;
  const y1 = (wrap(iv, cy) + 1 === cy ? 0 : wrap(iv, cy) + 1) * cx;
  const a = gx[y0 + x0] * fx + gy[y0 + x0] * fy;
  const b = gx[y0 + x1] * (fx - 1) + gy[y0 + x1] * fy;
  const c = gx[y1 + x0] * fx + gy[y1 + x0] * (fy - 1);
  const d = gx[y1 + x1] * (fx - 1) + gy[y1 + x1] * (fy - 1);
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const top = a + (b - a) * sx;
  return top + (c + (d - c) * sx - top) * sy;
}

async function renderLayer(cfg) {
  const { width: W, height: H, baseX, baseY, octaves, gain, warp, low, high, shadeMin, seed } = cfg;
  const rnd = mulberry32(seed);

  const warpX = makeLattice(3, 2, rnd);
  const warpY = makeLattice(3, 2, rnd);
  const lattices = [];
  let norm = 0;
  for (let o = 0, amp = 1; o < octaves; o++, amp *= gain) {
    lattices.push({ l: makeLattice(baseX * 2 ** o, baseY * 2 ** o, rnd), amp });
    norm += amp;
  }

  const field = new Float32Array(W * H);
  const coarse = new Float32Array(W * H); // first octaves only: smooth, used for the big billow lighting
  const alpha = new Float32Array(W * H);
  const ROWS = 24;
  const FIRST = Math.min(3, lattices.length);
  // Largest value the remaining (finer) octaves can still add; lets empty sky skip them.
  let restAmp = 0;
  for (let o = FIRST; o < lattices.length; o++) restAmp += lattices[o].amp;
  const restBound = (restAmp / norm) * 1.45 * 0.72;
  for (let y = 0; y < H; y++) {
    const ny = y / H;
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      // Warp the sampling position with a slow noise field to get puffy, rolling shapes.
      const wx = nx + warp * perlin(warpX, nx * 3, ny * 2);
      const wy = ny + warp * perlin(warpY, nx * 3, ny * 2);
      let n = 0;
      for (let o = 0; o < FIRST; o++) {
        const { l, amp } = lattices[o];
        n += amp * perlin(l, wx * l.cx, wy * l.cy);
      }
      let d = 0.5 + (n / norm) * 1.45;
      coarse[y * W + x] = d;
      if (d + restBound > low) {
        for (let o = FIRST; o < lattices.length; o++) {
          const { l, amp } = lattices[o];
          n += amp * perlin(l, wx * l.cx, wy * l.cy);
        }
        d = 0.5 + (n / norm) * 1.45;
      }
      const i = y * W + x;
      field[i] = d;
      alpha[i] = smoothstep(low, high, d);
    }
    if (y % ROWS === ROWS - 1) await nextFrame();
  }

  // Lighting: light comes from above (slightly left).
  //  - relief: where density falls off toward the light the surface faces it (bright billow tops),
  //    where density rises toward the light we sit in its shadow (grey folds and undersides).
  //  - occlusion: cloud mass lying between a pixel and the light darkens it softly.
  const scale = W / 1280;
  const len = Math.hypot(-0.22, -1);
  const lx = -0.22 / len;
  const ly = -1 / len;
  const reliefSteps = [10 * scale, 28 * scale];
  const occSteps = [8, 18, 32, 52, 78].map((v) => v * scale);
  const occWeights = [1, 1, 0.9, 0.7, 0.5];
  const occSum = occWeights.reduce((a, b) => a + b, 0);
  const at = (arr, x, y, dist) =>
    arr[wrap(Math.round(y + ly * dist), H) * W + wrap(Math.round(x + lx * dist), W)];

  const maskCanvas = document.createElement('canvas');
  const shadeCanvas = document.createElement('canvas');
  maskCanvas.width = shadeCanvas.width = W;
  maskCanvas.height = shadeCanvas.height = H;
  const maskCtx = maskCanvas.getContext('2d');
  const shadeCtx = shadeCanvas.getContext('2d');
  const maskImg = maskCtx.createImageData(W, H);
  const shadeImg = shadeCtx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = alpha[i];
      let gray = 1;
      if (a > 0.01) {
        const f = field[i];
        const c = coarse[i];
        const big = ((c - at(coarse, x, y, reliefSteps[0])) + 0.6 * (c - at(coarse, x, y, reliefSteps[1]))) / 1.6;
        const fine = ((f - at(field, x, y, reliefSteps[0] * 0.4)) + 0.6 * (f - at(field, x, y, reliefSteps[1] * 0.4))) / 1.6;
        const relief = big + 0.1 * fine;
        let occ = 0;
        // Occlusion from the smooth density with a wide ramp, so shadows fade in gradually.
        for (let s = 0; s < occSteps.length; s++) {
          occ += smoothstep(low - 0.14, high + 0.18, at(coarse, x, y, occSteps[s])) * occWeights[s];
        }
        occ /= occSum;
        // Soft S-curve: bright by default, smoothly darker in folds and under thick cloud (no hard clipping).
        const lit = 1 / (1 + Math.exp(-(1.5 + 2.2 * (relief * cfg.relief - occ * 0.3))));
        gray = (shadeMin + (1 - shadeMin) * lit) * (1 - 0.06 * a * a);
      }
      const k = i * 4;
      maskImg.data[k] = maskImg.data[k + 1] = maskImg.data[k + 2] = 255;
      maskImg.data[k + 3] = Math.round(a * 255);
      const g = Math.round(Math.min(1, gray) * 255);
      shadeImg.data[k] = shadeImg.data[k + 1] = shadeImg.data[k + 2] = g;
      shadeImg.data[k + 3] = 255;
    }
    if (y % (ROWS * 2) === ROWS * 2 - 1) await nextFrame();
  }
  maskCtx.putImageData(maskImg, 0, 0);
  shadeCtx.putImageData(shadeImg, 0, 0);
  return { mask: maskCanvas, shade: shadeCanvas };
}

function toObjectUrl(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png');
  });
}

export async function buildClouds(config) {
  for (const name of ['back', 'front']) {
    const el = document.getElementById(`cloud-${name}`);
    if (!el) continue;
    const cfg = config.layers[name];
    const { mask, shade } = await renderLayer(cfg);
    const [maskUrl, shadeUrl] = await Promise.all([toObjectUrl(mask), toObjectUrl(shade)]);
    el.style.setProperty('--cloud-mask', `url(${maskUrl})`);
    el.style.setProperty('--cloud-shade', `url(${shadeUrl})`);
    el.style.setProperty('--tile-aspect', String(cfg.width / cfg.height));
    el.classList.add('ready');
  }
}

// Best-candidate sampling keeps stars evenly random (no clumps, no grid-like rows);
// size, brightness and softness vary so only a few stand out.
export function buildStars(config) {
  const el = document.getElementById('stars');
  if (!el) return;
  const { count, maxY, minAlpha, maxAlpha, bigChance } = config.stars;
  const rnd = mulberry32(99);
  const pts = [];
  for (let i = 0; i < count; i++) {
    let best = null;
    let bestDist = -1;
    for (let k = 0; k < 10; k++) {
      const c = { x: rnd() * 100, y: rnd() * maxY };
      let d = Infinity;
      for (const p of pts) d = Math.min(d, (p.x - c.x) ** 2 + ((p.y - c.y) * 0.6) ** 2);
      if (d > bestDist) { bestDist = d; best = c; }
    }
    pts.push(best);
  }
  const shadows = pts.map((p) => {
    const brightness = rnd() ** 2; // most stars are faint
    const a = (minAlpha + brightness * (maxAlpha - minAlpha)).toFixed(2);
    const big = rnd() < bigChance;
    const blur = big ? 1.2 : 0.6;
    return `${p.x.toFixed(2)}vw ${p.y.toFixed(2)}vh ${blur}px ${big ? 0.3 : 0}px rgba(255,255,255,${a})`;
  });
  el.style.boxShadow = shadows.join(',');
}
