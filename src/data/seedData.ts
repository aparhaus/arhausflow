import { defaultPlannedLoadTotals, defaultPlannedTotals, shifts } from '../config/operationsConfig';
import type { HourlyUpdate, ShiftPlan } from '../types';
import { subDaysIso } from '../utils/date';

export const seedPlans: ShiftPlan[] = Array.from({ length: 7 }, (_, index) => {
  const date = subDaysIso(6 - index);
  return shifts.map((shift) => ({
    id: `${date}-${shift.id}`,
    date,
    shiftId: shift.id,
    plannedTotalVolume: defaultPlannedTotals[shift.id] ?? 1200,
    plannedLoadVolume: defaultPlannedLoadTotals[shift.id] ?? 600,
    breaks: shift.defaultBreaks,
    updatedAt: `${date}T12:00:00.000Z`,
  }));
}).flat();

export const seedUpdates: HourlyUpdate[] = Array.from({ length: 7 }, (_, dayIndex) => {
  const date = subDaysIso(6 - dayIndex);

  return shifts.flatMap((shift) =>
    shift.hours.map((hour, hourIndex) => {
      const basePicks = defaultPlannedTotals[shift.id] / shift.hours.length;
      const actualPicks = Math.round(
        basePicks *
          (0.9 + ((hourIndex % 3) * 0.06)) *
          (shift.id === 'night' ? 0.98 : shift.id === 'weekend' ? 1.03 : 1.0),
      );
      const updatedAt = new Date(`${date}T12:00:00.000Z`);
      updatedAt.setMinutes(updatedAt.getMinutes() + hourIndex);

      return {
        id: `${date}-${shift.id}-${hour.id}`,
        date,
        shiftId: shift.id,
        hourId: hour.id,
        actualPicks,
        totalInPacked: Math.round(actualPicks * 0.38),
        unitsLoaded: Math.round(actualPicks * 0.52),
        dockHeadcount: shift.id === 'weekend' ? 10 : 8,
        comments: hourIndex % 4 === 0 ? 'Normal flow.' : undefined,
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };
    }),
  );
}).flat();
