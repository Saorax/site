export function pageSlugForLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function readArrayParam(params, key) {
  const value = params.get(key);
  if (!value) return [];
  return value.split(',').map((item) => decodeURIComponent(item)).filter(Boolean);
}

export function readBoolParam(params, key) {
  const value = params.get(key);
  return value === '1' || value === 'true';
}

export function writeStringParam(params, key, value, fallback = '') {
  if (value && value !== fallback) params.set(key, String(value));
  else params.delete(key);
}

export function writeArrayParam(params, key, values) {
  if (Array.isArray(values) && values.length) params.set(key, values.map(encodeURIComponent).join(','));
  else params.delete(key);
}

export function writeBoolParam(params, key, value) {
  if (value) params.set(key, '1');
  else params.delete(key);
}
