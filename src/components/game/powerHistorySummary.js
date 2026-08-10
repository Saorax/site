function isEmptyPowerValue(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptyPowerValue);
  if (typeof value === 'object') {
    const values = Object.values(value);
    return values.length === 0 || values.every(isEmptyPowerValue);
  }
  const text = String(value).trim();
  return text === '' || /^-{2,}$/.test(text);
}

function commonFieldAction(fields) {
  const actions = fields.map((field) => {
    const beforeEmpty = isEmptyPowerValue(field?.before);
    const afterEmpty = isEmptyPowerValue(field?.after);
    if (beforeEmpty && !afterEmpty) return 'added';
    if (!beforeEmpty && afterEmpty) return 'removed';
    return 'updated';
  });
  return actions.every((action) => action === actions[0]) ? actions[0] : 'updated';
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function valueDeltas(before, after, path = '') {
  const beforeObject = before && typeof before === 'object' && !Array.isArray(before);
  const afterObject = after && typeof after === 'object' && !Array.isArray(after);
  if (beforeObject && afterObject) {
    const deltas = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        deltas.push({ path: childPath, action: 'added', before: undefined, after: after[key] });
      } else if (!Object.prototype.hasOwnProperty.call(after, key)) {
        deltas.push({ path: childPath, action: 'removed', before: before[key], after: undefined });
      } else {
        deltas.push(...valueDeltas(before[key], after[key], childPath));
      }
    }
    return deltas;
  }
  if (stableValue(before) === stableValue(after)) return [];
  const beforeEmpty = isEmptyPowerValue(before);
  const afterEmpty = isEmptyPowerValue(after);
  return [{
    path,
    action: beforeEmpty && !afterEmpty ? 'added' : !beforeEmpty && afterEmpty ? 'removed' : 'updated',
    before,
    after,
  }];
}

function deltaKey(delta) {
  return `${delta.action}|${delta.path}|${stableValue(delta.before)}|${stableValue(delta.after)}`;
}

export function summarizeCommonPowerFields(entries) {
  const changed = (entries || []).filter((entry) => entry?.type === 'changed' && Array.isArray(entry?.record?.fields));
  if (changed.length < 2) return { entries: entries || [], commonFields: [] };

  const occurrences = new Map();
  for (const entry of changed) {
    const fields = new Map(entry.record.fields.map((field) => [field?.field, field]));
    for (const [name, field] of fields) {
      if (!name) continue;
      if (!occurrences.has(name)) occurrences.set(name, []);
      occurrences.get(name).push(field);
    }
  }

  const commonFields = [...occurrences.entries()]
    .filter(([, fields]) => fields.length === changed.length)
    .map(([field, fields]) => {
      const deltasByRecord = fields.map((item) => valueDeltas(item?.before, item?.after));
      const firstDeltas = deltasByRecord[0] || [];
      const details = firstDeltas.filter((delta) => {
        const key = deltaKey(delta);
        return deltasByRecord.every((deltas) => deltas.some((candidate) => deltaKey(candidate) === key));
      });
      return {
        field,
        action: details.length && details.every((detail) => detail.action === details[0].action)
          ? details[0].action
          : commonFieldAction(fields),
        count: changed.length,
        details,
        variants: [...fields.reduce((variants, item) => {
          const key = `${stableValue(item?.before)}|${stableValue(item?.after)}`;
          const variant = variants.get(key);
          if (variant) variant.count += 1;
          else variants.set(key, { before: item?.before, after: item?.after, count: 1 });
          return variants;
        }, new Map()).values()],
      };
    })
    .filter((summary) => summary.details.length > 0);
  if (!commonFields.length) return { entries: entries || [], commonFields: [] };

  const commonDeltas = new Map(commonFields.map((field) => [
    field.field,
    new Set(field.details.map(deltaKey)),
  ]));
  const filteredEntries = (entries || []).map((entry) => {
    if (entry?.type !== 'changed' || !Array.isArray(entry?.record?.fields)) return entry;
    return {
      ...entry,
      record: {
        ...entry.record,
        fields: entry.record.fields.filter((field) => {
          const shared = commonDeltas.get(field?.field);
          if (!shared) return true;
          const deltas = valueDeltas(field?.before, field?.after);
          return deltas.some((delta) => !shared.has(deltaKey(delta)));
        }),
      },
    };
  }).filter((entry) => entry?.type !== 'changed' || entry.record.fields.length > 0);

  return { entries: filteredEntries, commonFields };
}

export function commonPowerFieldMessage(summary) {
  return `Shared ${summary.details.length === 1 ? 'property change' : 'property changes'} across ${summary.count} powers`;
}
