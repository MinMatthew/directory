// Everything tweakable about the sky lives here.
export const CONFIG = {
  // hour: local time in decimal hours. Values between keyframes are linearly interpolated (wrapping at midnight).
  // brightness -> --cloud-opacity multiplier, stars -> star layer opacity.
  keyframes: [
    { hour: 5,    top: '#2b3a67', bottom: '#f4a6a0', cloud: '#ffd3da', brightness: 0.8, stars: 0.2 },
    { hour: 8,    top: '#35679f', bottom: '#8aaccb', cloud: '#eef3f8', brightness: 1.0, stars: 0 },
    { hour: 13,   top: '#1f4f88', bottom: '#5f8dbb', cloud: '#eef3f8', brightness: 1.0, stars: 0 },
    { hour: 18.5, top: '#3b3f8f', bottom: '#ff9a5a', cloud: '#ffb27a', brightness: 0.8, stars: 0 },
    { hour: 21,   top: '#0b1430', bottom: '#1d2b57', cloud: '#8a9bb8', brightness: 0.5, stars: 0.85 },
  ],

  // Seasonal day length. refSunrise/refSunset are the keyframe hours that mark sunrise/sunset;
  // noon is the clock hour at the middle of the day. Latitude is fixed to fallbackLatitude
  // (signed by the time-zone hemisphere); no location permission is requested. minDay/maxDay clamp day length.
  season: { refSunrise: 6.5, refSunset: 19.5, noon: 13, fallbackLatitude: 35, minDay: 5, maxDay: 19 },

  // Text colour follows the lower sky: black on bright sky, white on dark sky (switches at light = 0.5).
  ink: { dark: '#000000', light: '#ffffff', lumaDark: 0.5, lumaLight: 0.25 },

  // Portrait scroll speeds of the header parts relative to the list (1 = same speed, >1 faster, <1 slower).
  hero: { textSpeed: 1.7, boxSpeed: 1, logoSpeed: 0.25 },

  updateIntervalMs: 60000,
  fadeMs: 5000,

  // Per layer: texture size, noise lattice (baseX/baseY cells, doubled per octave), gain per octave,
  // warp (domain-warp strength), low/high (coverage thresholds), relief (strength of the billowy
  // lighting), shadeMin (darkest cloud underside, 0-1).
  layers: {
    back: {
      width: 1024, height: 576, baseX: 9, baseY: 5, octaves: 4, gain: 0.5, warp: 0.12,
      low: 0.5, high: 0.72, relief: 3.5, shadeMin: 0.72, seed: 7,
    },
    front: {
      width: 1536, height: 864, baseX: 4, baseY: 2, octaves: 6, gain: 0.52, warp: 0.16,
      low: 0.49, high: 0.7, relief: 5, shadeMin: 0.55, seed: 21,
    },
  },

  // maxY: stars only in the upper part of the sky (% of height). Alpha is per star; --stars-opacity scales all.
  stars: { count: 110, maxY: 80, minAlpha: 0.12, maxAlpha: 0.5, bigChance: 0.08 },
};
