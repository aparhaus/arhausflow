import { seedPlans, seedUpdates } from '../data/seedData';
import type { HourlyUpdate, ShiftPlan } from '../types';
import { defaultPlannedLoadTotals, shifts } from '../config/operationsConfig';

const STORAGE_KEY = 'dc-shift-pace-tracker-state';

const isBrowser = typeof window !== 'undefined';

interface StoredState {
  plans: ShiftPlan[];
  updates: HourlyUpdate[];
}

const seedState: StoredState = {
  plans: seedPlans,
  updates: seedUpdates,
};

const parseState = (value: string | null): StoredState => {
  if (!value) {
    return seedState;
  }

  try {
    const parsed = JSON.parse(value) as StoredState;
    return {
      plans: parsed.plans ?? [],
      updates: parsed.updates ?? [],
    };
  } catch {
    return seedState;
  }
};

const legacyBreakSignatures: Record<string, string[]> = {
  day: ['09:00-09:15', '12:00-12:30', '15:00-15:15'],
  night: ['20:00-20:15', '23:00-23:30', '02:00-02:15'],
  weekend: ['09:00-09:15', '12:30-13:00', '16:00-16:15'],
};

const buildBreakSignature = (plan: ShiftPlan): string[] =>
  (plan.breaks ?? []).map((item) => `${item.start}-${item.end}`);

const shouldReplaceLegacyBreaks = (plan: ShiftPlan): boolean => {
  const legacy = legacyBreakSignatures[plan.shiftId];
  if (!legacy) {
    return false;
  }

  const current = buildBreakSignature(plan);
  return JSON.stringify(current) === JSON.stringify(legacy);
};

const normalizeUpdates = (updates: HourlyUpdate[]): HourlyUpdate[] =>
  updates.map((update) => ({
    ...update,
  }));

export const loadState = (): StoredState => {
  if (!isBrowser) {
    return seedState;
  }

  const state = parseState(window.localStorage.getItem(STORAGE_KEY));
  const normalizedPlans = state.plans.map((plan) => ({
    ...plan,
    plannedLoadVolume: plan.plannedLoadVolume ?? defaultPlannedLoadTotals[plan.shiftId] ?? 600,
    breaks:
      !plan.breaks || shouldReplaceLegacyBreaks(plan)
        ? shifts.find((shift) => shift.id === plan.shiftId)?.defaultBreaks ?? []
        : plan.breaks,
  }));
  const normalizedUpdates = normalizeUpdates(state.updates);

  if (!state.plans.length && !state.updates.length) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));
    return seedState;
  }

  return {
    ...state,
    plans: normalizedPlans,
    updates: normalizedUpdates,
  };
};

export const saveState = (state: StoredState): void => {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const replaceState = (state: StoredState): StoredState => {
  const next = {
    plans: state.plans ?? [],
    updates: state.updates ?? [],
  };
  saveState(next);
  return next;
};

export const upsertPlan = (state: StoredState, plan: ShiftPlan): StoredState => {
  const plans = [...state.plans];
  const index = plans.findIndex((item) => item.id === plan.id);

  if (index >= 0) {
    plans[index] = plan;
  } else {
    plans.unshift(plan);
  }

  const next = { ...state, plans };
  saveState(next);
  return next;
};

export const upsertUpdate = (state: StoredState, update: HourlyUpdate): StoredState => {
  const updates = [...state.updates];
  const index = updates.findIndex((item) => item.id === update.id);

  if (index >= 0) {
    updates[index] = update;
  } else {
    updates.unshift(update);
  }

  const next = { ...state, updates };
  saveState(next);
  return next;
};

export const deleteUpdate = (state: StoredState, updateId: string): StoredState => {
  const next = {
    ...state,
    updates: state.updates.filter((update) => update.id !== updateId),
  };
  saveState(next);
  return next;
};

export const clearShiftDayUpdates = (
  state: StoredState,
  date: string,
  shiftId: string,
): StoredState => {
  const next = {
    ...state,
    updates: state.updates.filter(
      (update) => !(update.date === date && update.shiftId === shiftId),
    ),
  };
  saveState(next);
  return next;
};
