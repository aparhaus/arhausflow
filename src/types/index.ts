export type MetricStatus = 'above' | 'on' | 'below';

export interface BreakWindow {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface HourBucket {
  id: string;
  label: string;
  hour24: number;
  minute: number;
}

export interface ShiftDefinition {
  id: string;
  name: string;
  shortName: string;
  schedule: string;
  days: string;
  productiveStart: string;
  productiveEnd: string;
  hours: HourBucket[];
  defaultBreaks: BreakWindow[];
}

export interface StatusThresholds {
  onTargetMin: number;
  aboveTargetMin: number;
}

export interface ShiftPlan {
  id: string;
  date: string;
  shiftId: string;
  plannedTotalVolume: number;
  plannedLoadVolume: number;
  breaks: BreakWindow[];
  updatedAt: string;
}

export interface HourlyUpdate {
  id: string;
  date: string;
  shiftId: string;
  hourId: string;
  actualPicks: number;
  totalInPacked?: number;
  unitsLoaded?: number;
  dockHeadcount?: number;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardFilters {
  date: string;
  shiftId: string;
}
