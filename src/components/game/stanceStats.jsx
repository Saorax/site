export const stats = [
  { key: 'str', label: 'Strength', runeKey: 'Strength', icon: '/game/attack.png' },
  { key: 'dex', label: 'Dexterity', runeKey: 'Dexterity', icon: '/game/dexterity.png' },
  { key: 'def', label: 'Defense', runeKey: 'Weight', icon: '/game/defense.png' },
  { key: 'spe', label: 'Speed', runeKey: 'Speed', icon: '/game/speed.png' },
];

export function statValue(source, stat) {
  const direct = Number(source?.[stat.key]);
  if (Number.isFinite(direct)) return direct;
  const rune = Number(source?.[stat.runeKey]);
  if (Number.isFinite(rune)) return rune;
  return 0;
}

export function statPipIcon(value, base, index) {
  const pip = index + 1;
  const filled = value >= pip;
  const baseFilled = base >= pip;
  if (index === 0 && filled) return '742';
  if (index === 9 && filled) return '751';
  if (index === 9 && !filled) return '753';
  if (filled && !baseFilled) return '746';
  if (!filled && baseFilled) return '747';
  if (filled) return '745';
  return '749';
}

export function StatMiniLine({ source, base }) {
  return (
    <div className="grid gap-1.5">
      {stats.map((stat) => {
        const value = statValue(source, stat);
        const baseValue = statValue(base, stat);
        return (
          <div key={stat.key} className="grid grid-cols-[1.5rem_1fr_1.75rem] items-center gap-1.5">
            <img src={stat.icon} className="h-5 w-5 object-contain" alt={stat.label} />
            <div className="flex min-w-0">
              {Array.from({ length: 10 }, (_, index) => (
                <img key={index} src={`/game/${statPipIcon(value, baseValue, index)}.png`} className="h-4 w-3.5 shrink-0 object-fill" alt="" aria-hidden="true" />
              ))}
            </div>
            <span className="text-right text-xs font-black">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
