import type { ShiftDefinition, StatusThresholds } from '../types';

const buildHours = (entries: Array<[string, number, number]>): ShiftDefinition['hours'] =>
  entries.map(([label, hour24, minute]) => ({
    id: label.replace(':', ''),
    label,
    hour24,
    minute,
  }));

export const shifts: ShiftDefinition[] = [
  {
    id: 'day',
    name: 'Mon-Thu Day Shift',
    shortName: 'Day Shift',
    schedule: '6:00 AM - 4:30 PM',
    days: 'Mon-Thu',
    productiveStart: '06:15',
    productiveEnd: '16:15',
    hours: buildHours([
      ['6:00', 6, 0],
      ['7:00', 7, 0],
      ['8:00', 8, 0],
      ['9:00', 9, 0],
      ['10:00', 10, 0],
      ['11:00', 11, 0],
      ['12:00', 12, 0],
      ['13:00', 13, 0],
      ['14:00', 14, 0],
      ['15:00', 15, 0],
      ['16:00', 16, 0],
    ]),
    defaultBreaks: [
      { id: 'break-1', label: '1st Break', start: '08:15', end: '08:30' },
      { id: 'break-2', label: 'Lunch', start: '11:45', end: '12:30' },
      { id: 'break-3', label: '2nd Break', start: '14:30', end: '14:45' },
    ],
  },
  {
    id: 'night',
    name: 'Mon-Thu Night Shift',
    shortName: 'Night Shift',
    schedule: '5:30 PM - 3:00 AM',
    days: 'Mon-Thu',
    productiveStart: '17:45',
    productiveEnd: '02:45',
    hours: buildHours([
      ['17:00', 17, 0],
      ['18:00', 18, 0],
      ['19:00', 19, 0],
      ['20:00', 20, 0],
      ['21:00', 21, 0],
      ['22:00', 22, 0],
      ['23:00', 23, 0],
      ['0:00', 0, 0],
      ['1:00', 1, 0],
      ['2:00', 2, 0],
      ['3:00', 3, 0],
    ]),
    defaultBreaks: [
      { id: 'break-1', label: '1st Break', start: '21:00', end: '21:45' },
      { id: 'break-2', label: 'Lunch', start: '00:00', end: '00:30' },
    ],
  },
  {
    id: 'weekend',
    name: 'Fri-Sun Weekend Shift',
    shortName: 'Weekend Shift',
    schedule: '6:00 AM - 6:30 PM',
    days: 'Fri-Sun',
    productiveStart: '06:15',
    productiveEnd: '18:15',
    hours: buildHours([
      ['6:00', 6, 0],
      ['7:00', 7, 0],
      ['8:00', 8, 0],
      ['9:00', 9, 0],
      ['10:00', 10, 0],
      ['11:00', 11, 0],
      ['12:00', 12, 0],
      ['13:00', 13, 0],
      ['14:00', 14, 0],
      ['15:00', 15, 0],
      ['16:00', 16, 0],
      ['17:00', 17, 0],
      ['18:00', 18, 0],
    ]),
    defaultBreaks: [
      { id: 'break-1', label: '1st Break', start: '08:30', end: '08:45' },
      { id: 'break-2', label: 'Lunch', start: '11:45', end: '12:30' },
      { id: 'break-3', label: '2nd Break', start: '14:30', end: '14:45' },
    ],
  },
];

export const defaultPlannedTotals: Record<string, number> = {
  day: 1500,
  night: 1205,
  weekend: 1750,
};

export const defaultPlannedLoadTotals: Record<string, number> = {
  day: 780,
  night: 625,
  weekend: 910,
};

export const currentInPackedTolerance = {
  minPercentOfShiftVolume: 0.2,
  maxPercentOfShiftVolume: 0.4,
};

export const statusThresholds: StatusThresholds = {
  onTargetMin: 0.98,
  aboveTargetMin: 1,
};

export const statusLabels = {
  above: 'Above Plan',
  on: 'On Plan',
  below: 'Below Plan',
} as const;

export const appConfig = {
  appName: 'DC Shift Pace Tracker',
  shifts,
  currentInPackedTolerance,
  statusThresholds,
};
