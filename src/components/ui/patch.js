export function isPatchNumber(value) {
  return /^\d+\.\d+(\.\d+)?$/.test(String(value ?? '').trim());
}

export function firstPatchNumber(...values) {
  for (const value of values) if (isPatchNumber(value)) return String(value).trim();
  return '';
}

function patchDate(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  const parsed = Number.isFinite(number) && String(value).trim() !== ''
    ? new Date(number < 1e12 ? number * 1000 : number)
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPatchDate(value) {
  const parsed = patchDate(value);
  return parsed ? parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

export function patchLabel(patch, date, { prefix = 'Patch ', datePrefix = '' } = {}) {
  if (isPatchNumber(patch)) return `${prefix}${String(patch).trim()}`;
  const shown = formatPatchDate(date);
  return shown ? `${datePrefix}${shown}` : '';
}
