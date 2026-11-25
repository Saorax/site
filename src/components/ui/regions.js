export const REGIONS = [
  ['NA', 'North America'],
  ['EU', 'Europe'],
  ['SA', 'South America'],
  ['SEA', 'Southeast Asia'],
  ['AUS', 'Australia'],
  ['MENA', 'Middle East'],
];

export const RETIRED_OFFICIAL_REGIONS = ['AUS'];

export const isRetiredOfficialRegion = (code) => RETIRED_OFFICIAL_REGIONS.includes(String(code || '').toUpperCase());

export const officialRegions = (...keep) => {
  const kept = new Set(keep.flat().filter(Boolean).map((code) => String(code).toUpperCase()));
  return REGIONS.filter(([code]) => !isRetiredOfficialRegion(code) || kept.has(code));
};

export const OFFICIAL_REGIONS = officialRegions();
