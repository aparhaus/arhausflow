import { getMetricStatus, getStatusClasses, getStatusLabel } from '../utils/metrics';

interface StatusBadgeProps {
  percentToGoal: number;
}

export function StatusBadge({ percentToGoal }: StatusBadgeProps) {
  const status = getMetricStatus(percentToGoal);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getStatusClasses(
        status,
      )}`}
    >
      {getStatusLabel(percentToGoal)}
    </span>
  );
}
