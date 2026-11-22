export function normalizeAddress(input) {
  const value = String(input ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  if (/^(localhost|(?:\d{1,3}\.){3}\d{1,3})(?:[/:]|$)/i.test(value)) return null;
  if (/^[a-z\d-]+(?:\.[a-z\d-]+)+(?:[:/]\S*)?$/i.test(value)) {
    try { return new URL(`https://${value}`).href; } catch { /* search below */ }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}
