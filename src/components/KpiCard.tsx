interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: 'border-white/10 bg-white/5',
  good: 'border-emerald-400/20 bg-emerald-500/10',
  warn: 'border-amber-400/20 bg-amber-500/10',
  bad: 'border-rose-400/20 bg-rose-500/10',
};

export function KpiCard({ label, value, detail, tone = 'neutral' }: KpiCardProps) {
  return (
    <article className={`rounded-2xl border p-5 shadow-panel ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">{label}</p>
      <p className="mt-3 whitespace-pre-line text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </article>
  );
}
