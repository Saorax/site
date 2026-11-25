const paths = {
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0V4Z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8', 'M10 17h4'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6'],
  bracket: ['M4 5h5v4H4z', 'M4 15h5v4H4z', 'M9 7h3v10H9', 'M12 12h3', 'M15 10h5v4h-5z'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18', 'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z'],
  legend: ['M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z', 'M9 11l2 2 4-4'],
  scroll: ['M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7', 'M7 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2Z', 'M7 20a2 2 0 0 1-2-2', 'M10 9h6', 'M10 13h6', 'M10 17h3'],
  bolt: ['M13 3 5 14h6l-1 7 8-11h-6l1-7Z'],
  bag: ['M5 8h14l-1 12H6L5 8Z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  map: ['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z', 'M9 4v14', 'M15 6v14'],
  film: ['M4 5h16v14H4z', 'M8 5v14', 'M16 5v14', 'M4 9h4', 'M4 15h4', 'M16 9h4', 'M16 15h4'],
  palette: ['M12 3a9 9 0 0 0 0 18c1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5h2A4.5 4.5 0 0 0 21 11c0-4.4-4-8-9-8Z', 'M7.5 11.5h.01', 'M10 7.5h.01', 'M14.5 7.5h.01'],
  puzzle: ['M10 4a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v4h-4v-2a2 2 0 0 0-4 0v2H6v-4h2a2 2 0 0 0 0-4H6V6h4V4Z'],
  sliders: ['M4 7h10', 'M18 7h2', 'M16 5v4', 'M4 17h4', 'M12 17h8', 'M10 15v4', 'M4 12h6', 'M14 12h6', 'M12 10v4'],
  grid: ['M4 4h16v16H4z', 'M4 12h16', 'M12 4v16', 'M7 16h2', 'M15 8h2'],
  list: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
  ranks: ['M6 10l6-4 6 4', 'M6 15l6-4 6 4', 'M6 20l6-4 6 4'],
  banner: ['M6 3h12v17l-6-4-6 4V3Z', 'M9 8h6', 'M9 11h6'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  calculator: ['M6 3h12v18H6z', 'M9 6.5h6v3H9z', 'M9 13h.01', 'M12 13h.01', 'M15 13h.01', 'M9 17h.01', 'M12 17h.01', 'M15 17h.01'],
  chart: ['M4 20h16', 'M7 16v-5', 'M12 16V6', 'M17 16v-8'],
  spark: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M6 6l2.5 2.5', 'M15.5 15.5 18 18', 'M18 6l-2.5 2.5', 'M8.5 15.5 6 18'],
  news: ['M5 5h12v14H6a1 1 0 0 1-1-1V5Z', 'M17 9h2v9a1 1 0 0 1-2 0', 'M8 8h6', 'M8 12h6', 'M8 16h3'],
  swords: ['M5 5l10 10', 'M19 5 9 15', 'M13 17l4-4', 'M11 17l-4-4', 'M17 19l2-2', 'M7 19l-2-2'],
};

export default function ToolIcon({ name, className = 'h-5 w-5' }) {
  const lines = paths[name] || paths.spark;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {lines.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
