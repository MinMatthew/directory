// Time-of-day palette interpolation -> CSS variables on :root.

import { initLatitude, toReferenceHour } from './season.js';

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lerp = (a, b, t) => a + (b - a) * t;
const lerpRgb = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function samplePalette(keyframes, hour) {
  const frames = keyframes.map((k) => ({
    hour: k.hour,
    top: hexToRgb(k.top),
    bottom: hexToRgb(k.bottom),
    cloud: hexToRgb(k.cloud),
    brightness: k.brightness,
    stars: k.stars,
  }));
  frames.sort((a, b) => a.hour - b.hour);

  let h = ((hour % 24) + 24) % 24;
  if (h < frames[0].hour) h += 24;
  let i = frames.length - 1;
  for (let j = 0; j < frames.length; j++) if (frames[j].hour <= h) i = j;
  const a = frames[i];
  const next = frames[(i + 1) % frames.length];
  const bHour = i + 1 < frames.length ? next.hour : next.hour + 24;
  const t = clamp01((h - a.hour) / (bHour - a.hour));

  return {
    top: lerpRgb(a.top, next.top, t),
    bottom: lerpRgb(a.bottom, next.bottom, t),
    cloud: lerpRgb(a.cloud, next.cloud, t),
    brightness: lerp(a.brightness, next.brightness, t),
    stars: lerp(a.stars, next.stars, t),
  };
}

const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function startSky(config) {
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const params = new URLSearchParams(location.search);
  const hourParam = parseFloat(params.get('hour'));
  const speedParam = parseFloat(params.get('speed'));
  const hasHour = Number.isFinite(hourParam);
  const speed = Number.isFinite(speedParam) && speedParam > 0 ? speedParam : 1;
  const inkDark = hexToRgb(config.ink.dark);
  const inkLight = hexToRgb(config.ink.light);

  const localHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  };
  const startHour = hasHour ? hourParam : localHour();
  const startReal = performance.now();

  const currentHour = () => {
    if (speed === 1) return hasHour ? hourParam : localHour();
    return startHour + ((performance.now() - startReal) / 3600000) * speed;
  };

  const interval = Math.max(250, config.updateIntervalMs / speed);
  const fadeMs = Math.min(config.fadeMs, interval);
  let timer = null;

  const apply = () => {
    const p = samplePalette(config.keyframes, toReferenceHour(currentHour(), config));
    const light = clamp01((config.ink.lumaDark - luma(p.bottom)) / (config.ink.lumaDark - config.ink.lumaLight));
    const style = root.style;
    style.setProperty('--sky-top', rgbToHex(p.top));
    style.setProperty('--sky-bottom', rgbToHex(p.bottom));
    style.setProperty('--cloud-tint', rgbToHex(p.cloud));
    style.setProperty('--cloud-opacity', p.brightness.toFixed(3));
    style.setProperty('--stars-opacity', p.stars.toFixed(3));
    style.setProperty('--ink', rgbToHex(lerpRgb(inkDark, inkLight, light)));
    if (themeMeta) themeMeta.content = rgbToHex(p.top);
  };

  const start = () => {
    stop();
    apply();
    if (!hasHour || speed !== 1) timer = setInterval(apply, interval);
    root.classList.remove('paused');
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  // First paint without a transition so the sky does not animate in from the defaults.
  root.style.transitionDuration = '0s';
  apply();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.style.transitionDuration = `${fadeMs}ms`;
  }));
  if (!hasHour || speed !== 1) timer = setInterval(apply, interval);

  initLatitude(apply);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
      root.classList.add('paused');
    } else {
      start();
    }
  });
}
