// User-agent hints are descriptive, untrusted metadata, never security evidence.
export function describeSession(agent?: string | null) {
  const ua = (agent || '').slice(0, 2048);
  const device = /iPad/i.test(ua) ? 'iPad' : /iPhone/i.test(ua) ? 'iPhone' : /Android/i.test(ua) ? 'Android device' : /Windows/i.test(ua) ? 'Windows device' : /Macintosh|Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux device' : 'Device';
  const browser = /Edg(?:e|A|iOS)?\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Browser';
  return ua ? `${device} · ${browser}` : 'Authenticated session';
}
export function sessionDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Date(value).toLocaleString();
}
