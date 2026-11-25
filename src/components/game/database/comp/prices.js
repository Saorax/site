const amount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function bundleMammothPrice(store) {
  const direct = amount(store?.IdolCost) || amount(store?.IdolSaleCost);
  if (direct > 0) return direct;
  const worth = (Array.isArray(store?.ItemList) ? store.ItemList : [])
    .reduce((sum, item) => sum + (amount(item?.IdolCost) || amount(item?.IdolSaleCost)), 0);
  const discount = amount(store?.IdolBundleDiscount);
  return discount > 0 && discount < 1 ? Math.floor(worth * discount) : worth;
}
