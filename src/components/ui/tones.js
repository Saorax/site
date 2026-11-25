export const toneNames = ['slate', 'blue', 'emerald', 'amber', 'rose', 'sky', 'violet'];

export const pillTones = {
  slate: 'border-slate-600 bg-slate-700/70 text-slate-200',
  blue: 'border-blue-400/30 bg-blue-500/15 text-blue-200',
  emerald: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  amber: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  rose: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
  sky: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  violet: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
};

export const badgeTones = {
  slate: 'border-slate-400/40 bg-slate-500/20 text-slate-100',
  blue: 'border-blue-300/40 bg-blue-500/20 text-blue-100',
  emerald: 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100',
  amber: 'border-amber-300/40 bg-amber-500/20 text-amber-100',
  rose: 'border-rose-300/40 bg-rose-500/20 text-rose-100',
  sky: 'border-sky-300/40 bg-sky-500/20 text-sky-100',
  violet: 'border-violet-300/40 bg-violet-500/20 text-violet-100',
};

export const textTones = {
  slate: 'text-slate-300',
  blue: 'text-blue-200',
  emerald: 'text-emerald-200',
  amber: 'text-amber-100',
  rose: 'text-rose-200',
  sky: 'text-sky-200',
  violet: 'text-violet-200',
};

export const sectionBorders = {
  slate: 'border-slate-700',
  blue: 'border-blue-400/40',
  emerald: 'border-emerald-400/40',
  amber: 'border-amber-400/40',
  rose: 'border-rose-500/40',
  sky: 'border-sky-400/40',
  violet: 'border-violet-500/40',
};

export const cx = (...values) => values.filter(Boolean).join(' ');
