// Seasonal day length: stretches/squeezes the keyframe day so winter nights are long and summer days are long.

const RAD = Math.PI / 180;

const SOUTH_TZ = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Pago_Pago|Tahiti|Noumea|Port_Moresby|Guadalcanal|Efate|Rarotonga|Niue|Norfolk)$|^America\/(Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Cuiaba|Campo_Grande|Bahia|Fortaleza|Recife|Manaus|Belem|Argentina\/.*|Buenos_Aires|Cordoba|Punta_Arenas)$|^Africa\/(Johannesburg|Maseru|Mbabane|Windhoek|Harare|Lusaka|Maputo|Luanda|Lubumbashi|Gaborone|Blantyre|Kinshasa|Brazzaville|Dar_es_Salaam|Nairobi)$|^Indian\/(Antananarivo|Mauritius|Reunion|Comoro|Mayotte)$|^Asia\/Jakarta$/;

function isSouthernHemisphere() {
  const jan = new Date(new Date().getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(new Date().getFullYear(), 6, 1).getTimezoneOffset();
  // getTimezoneOffset is smaller while DST is active: summer in January means south.
  if (jan !== jul) return jan < jul;
  try {
    return SOUTH_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  } catch {
    return false;
  }
}

// No location permission is requested: the hemisphere comes from the device time zone.
let latitude = null;

export function getLatitude(config) {
  if (latitude === null) {
    const forced = parseFloat(new URLSearchParams(location.search).get('lat')); // debug override
    const fallback = config.season.fallbackLatitude;
    latitude = Number.isFinite(forced) ? Math.max(-90, Math.min(90, forced)) : isSouthernHemisphere() ? -fallback : fallback;
  }
  return latitude;
}

function dayOfYear(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

export function dayLengthHours(lat, date, { minDay, maxDay }) {
  const decl = 23.44 * Math.sin(2 * Math.PI * (284 + dayOfYear(date)) / 365) * RAD;
  const cosH = -Math.tan(lat * RAD) * Math.tan(decl);
  const len = (24 / Math.PI) * Math.acos(Math.min(1, Math.max(-1, cosH)));
  return Math.min(maxDay, Math.max(minDay, len));
}

// Maps a clock hour to the keyframe ("reference") hour so that real sunrise/sunset land on the reference ones.
export function toReferenceHour(hour, config, date = new Date()) {
  const { refSunrise, refSunset, noon } = config.season;
  const day = dayLengthHours(getLatitude(config), date, config.season);
  const sunrise = noon - day / 2;
  const sunset = noon + day / 2;

  let h = ((hour % 24) + 24) % 24;
  if (h < sunrise) h += 24;
  if (h <= sunset) return refSunrise + ((h - sunrise) / (sunset - sunrise)) * (refSunset - refSunrise);
  return refSunset + ((h - sunset) / (sunrise + 24 - sunset)) * (refSunrise + 24 - refSunset);
}
