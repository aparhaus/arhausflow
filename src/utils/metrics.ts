import { statusLabels, statusThresholds } from '../config/operationsConfig';
import type { BreakWindow, HourBucket, HourlyUpdate, MetricStatus, ShiftDefinition } from '../types';

export const roundNumber = (value: number, digits = 1): number =>
  Number(value.toFixed(digits));

export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

export const formatVariance = (value: number): string => {
  const rounded = roundNumber(value, 1);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
};

export const getMetricStatus = (percentToPlan: number): MetricStatus => {
  if (percentToPlan > statusThresholds.aboveTargetMin) {
    return 'above';
  }

  if (percentToPlan >= statusThresholds.onTargetMin) {
    return 'on';
  }

  return 'below';
};

export const getStatusLabel = (percentToPlan: number): string =>
  statusLabels[getMetricStatus(percentToPlan)];

export const getStatusClasses = (status: MetricStatus): string => {
  if (status === 'above') {
    return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200';
  }

  if (status === 'on') {
    return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
  }

  return 'border-rose-400/30 bg-rose-500/15 text-rose-200';
};

const resolveTimeOnShiftDate = (date: string, shift: ShiftDefinition, clock: string): Date => {
  const [hours, minutes] = clock.split(':').map(Number);
  const firstHour = shift.hours[0].hour24;
  const base = new Date(`${date}T00:00:00`);
  const resolved = new Date(base);
  resolved.setDate(base.getDate() + (hours < firstHour ? 1 : 0));
  resolved.setHours(hours, minutes, 0, 0);
  return resolved;
};

const getShiftProductiveWindow = (date: string, shift: ShiftDefinition) => ({
  start: resolveTimeOnShiftDate(date, shift, shift.productiveStart),
  end: resolveTimeOnShiftDate(date, shift, shift.productiveEnd),
});

export const buildHourRange = (
  date: string,
  shift: ShiftDefinition,
  hour: HourBucket,
  nextHour?: HourBucket,
): { start: Date; end: Date } => {
  const start = resolveTimeOnShiftDate(date, shift, `${String(hour.hour24).padStart(2, '0')}:${String(hour.minute).padStart(2, '0')}`);
  if (nextHour) {
    const end = resolveTimeOnShiftDate(
      date,
      shift,
      `${String(nextHour.hour24).padStart(2, '0')}:${String(nextHour.minute).padStart(2, '0')}`,
    );
    return { start, end };
  }

  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { start, end };
};

const getOverlapMinutes = (leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date): number => {
  const start = Math.max(leftStart.getTime(), rightStart.getTime());
  const end = Math.min(leftEnd.getTime(), rightEnd.getTime());
  return Math.max(0, end - start) / 60000;
};

export const getProductiveMinutesByHour = (
  date: string,
  shift: ShiftDefinition,
  breaks: BreakWindow[],
): number[] => {
  const shiftWindow = getShiftProductiveWindow(date, shift);
  const breakRanges = breaks.map((item) => ({
    ...item,
    startDate: resolveTimeOnShiftDate(date, shift, item.start),
    endDate: resolveTimeOnShiftDate(date, shift, item.end),
  }));

  return shift.hours.map((hour, index) => {
    const nextHour = shift.hours[index + 1];
    const range = buildHourRange(date, shift, hour, nextHour);
    const clippedStart = new Date(Math.max(range.start.getTime(), shiftWindow.start.getTime()));
    const clippedEnd = new Date(Math.min(range.end.getTime(), shiftWindow.end.getTime()));
    const totalMinutes = Math.max(0, clippedEnd.getTime() - clippedStart.getTime()) / 60000;
    const breakMinutes = sum(
      breakRanges.map((breakRange) =>
        getOverlapMinutes(clippedStart, clippedEnd, breakRange.startDate, breakRange.endDate),
      ),
    );
    return Math.max(0, totalMinutes - breakMinutes);
  });
};

export const allocateExpectedByHour = (
  plannedTotal: number,
  productiveMinutesByHour: number[],
): number[] => {
  const totalWeight = productiveMinutesByHour.reduce((sum, minutes) => sum + minutes, 0);
  const raw = productiveMinutesByHour.map((minutes) => (plannedTotal * minutes) / totalWeight);
  const base = raw.map((value) => Math.floor(value));
  let remainder = Math.round(plannedTotal - base.reduce((sum, value) => sum + value, 0));

  const ranked = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < ranked.length && remainder > 0; index += 1) {
    base[ranked[index].index] += 1;
    remainder -= 1;
  }

  return base;
};

export const derivePercentToPlan = (actual: number, planned: number): number =>
  planned === 0 ? 0 : actual / planned;

export const getLatestCompletedHourIndex = (
  shift: ShiftDefinition,
  updates: HourlyUpdate[],
): number => {
  let completedIndex = -1;

  shift.hours.forEach((hour, index) => {
    if (updates.some((update) => update.hourId === hour.id)) {
      completedIndex = index;
    }
  });

  return completedIndex;
};

export const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

export const average = (values: number[]): number =>
  values.length ? sum(values) / values.length : 0;
