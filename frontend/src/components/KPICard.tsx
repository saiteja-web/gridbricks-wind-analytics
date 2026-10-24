import React from 'react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  badge?: string;
  badgeTone?: 'emerald' | 'amber' | 'rose' | 'sky';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  badge,
  badgeTone = 'sky',
}) => {
  const toneClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  }[badgeTone];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {badge && (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClasses}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
};