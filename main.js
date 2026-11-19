import { APPS } from './apps.js';
import { CONFIG } from './config.js';
import { buildClouds, buildStars } from './clouds.js';
import { startSky } from './sky.js';

const SUPPORTED = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de'];

// ?lang=xx (debug) -> first supported device language -> en
function detectLang() {
  const forced = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(forced)) return forced;
  const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  for (const p of prefs) {
    const code = String(p).toLowerCase().split('-')[0];
    if (SUPPORTED.includes(code)) return code;
  }
  return 'en';
}

const lang = detectLang();
document.documentElement.lang = lang;

function renderApps() {
  const list = document.getElementById('apps');
  APPS.forEach((app, i) => {
    const li = document.createElement('li');
    li.className = 'app';
    li.style.setProperty('--i', Math.min(i, 8));

    const a = document.createElement('a');
    a.href = app.url;

    const img = document.createElement('img');
    img.src = app.icon;
    img.alt = '';
    img.width = img.height = 256;
    img.decoding = 'async';

    const text = document.createElement('span');
    text.className = 'app-text';
    const name = document.createElement('span');
    name.className = 'app-name';
    name.textContent = app.name;
    const desc = document.createElement('span');
    desc.className = 'app-desc';
    desc.textContent = app.desc[lang] || app.desc.en || '';
    text.append(name, desc);

    a.append(img, text);
    li.append(a);
    list.append(li);
  });
}

// Portrait: title / box / logo scroll up at different speeds and fade out in that order.
// speed is relative to the list: 1 = same as the list, >1 leaves faster, <1 lingers.
function setupHeroFade() {
  const hero = document.getElementById('hero');
  const { textSpeed, boxSpeed, logoSpeed } = CONFIG.hero;
  const parts = [
    { el: document.getElementById('hero-title'), speed: textSpeed, from: 0, to: 0.3 },
    { el: document.getElementById('hero-box'), speed: boxSpeed, from: 0.2, to: 0.6 },
    { el: document.getElementById('hero-logo'), speed: logoSpeed, from: 0.45, to: 0.85 },
  ];
  const landscape = matchMedia('(orientation: landscape)');
  let queued = false;

  const update = () => {
    queued = false;
    const h = hero.offsetHeight || 1;
    const fixed = landscape.matches;
    const y = fixed ? 0 : Math.max(0, window.scrollY);
    // Progress is measured against the distance that can really be scrolled, so the header
    // is always fully gone at the bottom even if the page is shorter than the hero or the
    // browser toolbars change the viewport height.
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const range = Math.max(1, Math.min(h, maxScroll));
    for (const { el, speed, from, to } of parts) {
      const p = Math.min(1, Math.max(0, (y / range - from) / (to - from)));
      el.style.opacity = fixed ? '' : String(1 - p);
      el.style.transform = fixed || speed === 1 ? '' : `translate3d(0, ${((1 - speed) * y).toFixed(1)}px, 0)`;
    }
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  landscape.addEventListener('change', schedule);
  update();
}

renderApps();
setupHeroFade();
buildStars(CONFIG);
startSky(CONFIG);
buildClouds(CONFIG);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
