import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  appConfig,
  currentInPackedTolerance,
  defaultPlannedLoadTotals,
  defaultPlannedTotals,
  shifts,
} from './config/operationsConfig';
import { KpiCard } from './components/KpiCard';
import { StatusBadge } from './components/StatusBadge';
import { clearShiftDayUpdates, deleteUpdate, loadState, replaceState, upsertPlan, upsertUpdate } from './services/storage';
import type { BreakWindow, DashboardFilters, HourlyUpdate, ShiftPlan } from './types';
import { formatDisplayDate, todayIso } from './utils/date';
import {
  allocateExpectedByHour,
  buildHourRange,
  derivePercentToPlan,
  formatPercent,
  formatVariance,
  getLatestCompletedHourIndex,
  getMetricStatus,
  getProductiveMinutesByHour,
  roundNumber,
  sum,
} from './utils/metrics';

interface HourlyEntryForm {
  hourId: string;
  actualPicks: string;
  totalInPacked: string;
  unitsLoaded: string;
  dockHeadcount: string;
  comments: string;
}

const defaultFilters: DashboardFilters = {
  date: todayIso(),
  shiftId: 'night',
};

const victoryImageUrl =
  'https://m.media-amazon.com/images/I/91ZAU74-xIL._AC_UF894,1000_QL80_.jpg';
const failureImageUrl =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ3msqy_hucJ3T-hO5V2-fRuja2V4z-SBYQUg&s';

export default function App() {
  const snapshotRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState(() => loadState());
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [plannedTotalInput, setPlannedTotalInput] = useState('');
  const [plannedLoadInput, setPlannedLoadInput] = useState('');
  const [breaksInput, setBreaksInput] = useState<BreakWindow[]>([]);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<HourlyEntryForm>({
    hourId: shifts[1].hours[0].id,
    actualPicks: '',
    totalInPacked: '',
    unitsLoaded: '',
    dockHeadcount: '8',
    comments: '',
  });

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === filters.shiftId) ?? shifts[0],
    [filters.shiftId],
  );

  const selectedPlan = useMemo<ShiftPlan>(() => {
    return (
      state.plans.find((plan) => plan.date === filters.date && plan.shiftId === filters.shiftId) ?? {
        id: `${filters.date}-${filters.shiftId}`,
        date: filters.date,
        shiftId: filters.shiftId,
        plannedTotalVolume: defaultPlannedTotals[filters.shiftId] ?? 1205,
        plannedLoadVolume: defaultPlannedLoadTotals[filters.shiftId] ?? 600,
        breaks: selectedShift.defaultBreaks,
        updatedAt: new Date().toISOString(),
      }
    );
  }, [state.plans, filters.date, filters.shiftId, selectedShift.defaultBreaks]);

  const shiftUpdates = useMemo(
    () =>
      state.updates
        .filter((update) => update.date === filters.date && update.shiftId === filters.shiftId)
        .sort((left, right) => {
          const leftIndex = selectedShift.hours.findIndex((hour) => hour.id === left.hourId);
          const rightIndex = selectedShift.hours.findIndex((hour) => hour.id === right.hourId);
          return leftIndex - rightIndex;
        }),
    [state.updates, filters.date, filters.shiftId, selectedShift.hours],
  );

  useEffect(() => {
    setPlannedTotalInput(String(selectedPlan.plannedTotalVolume));
    setPlannedLoadInput(String(selectedPlan.plannedLoadVolume));
    setBreaksInput(selectedPlan.breaks);
  }, [selectedPlan]);

  useEffect(() => {
    setEntryForm({
      hourId: selectedShift.hours[0].id,
      actualPicks: '',
      totalInPacked: '',
      unitsLoaded: '',
      dockHeadcount: filters.shiftId === 'weekend' ? '10' : '8',
      comments: '',
    });
    setEditingUpdateId(null);
  }, [selectedShift, filters.date]);

  const productiveMinutesByHour = useMemo(
    () => getProductiveMinutesByHour(filters.date, selectedShift, breaksInput),
    [filters.date, selectedShift, breaksInput],
  );

  const expectedByHour = useMemo(
    () => allocateExpectedByHour(selectedPlan.plannedTotalVolume, productiveMinutesByHour),
    [selectedPlan.plannedTotalVolume, productiveMinutesByHour],
  );
  const expectedLoadedByHour = useMemo(
    () => allocateExpectedByHour(selectedPlan.plannedLoadVolume, productiveMinutesByHour),
    [selectedPlan.plannedLoadVolume, productiveMinutesByHour],
  );

  const completedHourIndex = getLatestCompletedHourIndex(selectedShift, shiftUpdates);
  const latestCompletedHourLabel =
    completedHourIndex >= 0 ? selectedShift.hours[completedHourIndex]?.label : 'No hours entered yet';
  const packedMin = Math.round(
    selectedPlan.plannedTotalVolume * currentInPackedTolerance.minPercentOfShiftVolume,
  );
  const packedMax = Math.round(
    selectedPlan.plannedTotalVolume * currentInPackedTolerance.maxPercentOfShiftVolume,
  );

  const rows = selectedShift.hours.map((hour, index) => {
    const update = shiftUpdates.find((item) => item.hourId === hour.id);
    const expectedPicks = expectedByHour[index] ?? 0;
    const actualPicks = update?.actualPicks ?? 0;
    const delta = actualPicks - expectedPicks;
    const cumulativeExpected = sum(expectedByHour.slice(0, index + 1));
    const cumulativePicks = sum(
      selectedShift.hours.slice(0, index + 1).map((slot) => {
        const slotUpdate = shiftUpdates.find((item) => item.hourId === slot.id);
        return slotUpdate?.actualPicks ?? 0;
      }),
    );
    const cumulativeDelta = cumulativePicks - cumulativeExpected;
    const cumulativeLoaded = sum(
      selectedShift.hours.slice(0, index + 1).map((slot) => {
        const slotUpdate = shiftUpdates.find((item) => item.hourId === slot.id);
        return slotUpdate?.unitsLoaded ?? 0;
      }),
    );
    const expectedLoaded = expectedLoadedByHour[index] ?? 0;
    const loadedDelta = (update?.unitsLoaded ?? 0) - expectedLoaded;
    const cumulativeLoadedExpected = sum(expectedLoadedByHour.slice(0, index + 1));
    const cumulativeLoadedDelta = cumulativeLoaded - cumulativeLoadedExpected;
    const cumulativePacked = sum(
      selectedShift.hours.slice(0, index + 1).map((slot) => {
        const slotUpdate = shiftUpdates.find((item) => item.hourId === slot.id);
        return slotUpdate?.totalInPacked ?? 0;
      }),
    );
    const cumulativeDockHours = sum(
      selectedShift.hours.slice(0, index + 1).map((slot) => {
        const slotIndex = selectedShift.hours.findIndex((item) => item.id === slot.id);
        const slotUpdate = shiftUpdates.find((item) => item.hourId === slot.id);
        const slotProdMinutes = productiveMinutesByHour[slotIndex] ?? 0;
        return (slotUpdate?.dockHeadcount ?? 0) * (slotProdMinutes / 60);
      }),
    );
    const rowDockHours = (update?.dockHeadcount ?? 0) * ((productiveMinutesByHour[index] ?? 0) / 60);
    const pickOnPlan = actualPicks >= expectedPicks && actualPicks > 0;
    const loadOnPlan = (update?.unitsLoaded ?? 0) >= expectedLoaded && (update?.unitsLoaded ?? 0) > 0;
    const packedInBand =
      (update?.totalInPacked ?? 0) >= packedMin && (update?.totalInPacked ?? 0) <= packedMax && (update?.totalInPacked ?? 0) > 0;

    return {
      hour,
      expectedPicks,
      actualPicks,
      delta,
      cumulativeExpected,
      cumulativePicks,
      cumulativeDelta,
      expectedLoaded,
      loadedDelta,
      cumulativeLoadedExpected,
      cumulativeLoaded,
      cumulativeLoadedDelta,
      totalInPacked: update?.totalInPacked ?? 0,
      cumulativePacked,
      dockHeadcount: update?.dockHeadcount ?? 0,
      dockHours: roundNumber(rowDockHours, 2),
      unitsLoaded: update?.unitsLoaded ?? 0,
      dockPphHourly:
        rowDockHours && update?.unitsLoaded
          ? roundNumber(update.unitsLoaded / rowDockHours, 1)
          : 0,
      dockPphShift:
        cumulativeDockHours && cumulativeLoaded
          ? roundNumber(cumulativeLoaded / cumulativeDockHours, 1)
          : 0,
      productiveMinutes: productiveMinutesByHour[index] ?? 0,
      pickOnPlan,
      loadOnPlan,
      packedInBand,
      update,
      isCounted: index <= completedHourIndex,
    };
  });

  const countedRows = completedHourIndex >= 0 ? rows.slice(0, completedHourIndex + 1) : [];
  const lastCountedRow = countedRows[countedRows.length - 1];
  const expectedToNow = lastCountedRow?.cumulativeExpected ?? 0;
  const actualToNow = lastCountedRow?.cumulativePicks ?? 0;
  const deltaToNow = actualToNow - expectedToNow;
  const percentToNow = derivePercentToPlan(actualToNow, expectedToNow);
  const totalLoadedToNow = sum(countedRows.map((row) => row.unitsLoaded));
  const expectedLoadedToNow = sum(countedRows.map((row) => row.expectedLoaded));
  const loadedPercentToPlan = derivePercentToPlan(totalLoadedToNow, expectedLoadedToNow);
  const totalLoadDeltaToNow = totalLoadedToNow - expectedLoadedToNow;
  const totalDockHoursToNow = roundNumber(sum(countedRows.map((row) => row.dockHours)), 2);
  const currentDockPph =
    totalDockHoursToNow > 0 ? roundNumber(totalLoadedToNow / totalDockHoursToNow, 1) : 0;
  const remainingToGoal = selectedPlan.plannedTotalVolume - actualToNow;
  const productiveMinutesToNow = sum(countedRows.map((row) => row.productiveMinutes));
  const totalProductiveMinutes = sum(productiveMinutesByHour);
  const latestPackedValue = lastCountedRow?.totalInPacked ?? 0;
  const packedInTolerance = latestPackedValue >= packedMin && latestPackedValue <= packedMax;
  const showVictoryBanner = deltaToNow > 0 && totalLoadDeltaToNow > 0;
  const showFailureBanner = deltaToNow < 0 && totalLoadDeltaToNow < 0;

  const handleSavePlan = () => {
    const now = new Date().toISOString();
    setState((current) =>
      upsertPlan(current, {
        id: `${filters.date}-${filters.shiftId}`,
        date: filters.date,
        shiftId: filters.shiftId,
        plannedTotalVolume: Number(plannedTotalInput),
        plannedLoadVolume: Number(plannedLoadInput),
        breaks: breaksInput,
        updatedAt: now,
      }),
    );
  };

  const handleSaveUpdate = () => {
    const now = new Date().toISOString();
    const updateId = `${filters.date}-${filters.shiftId}-${entryForm.hourId}`;

    setState((current) =>
      upsertUpdate(current, {
        id: updateId,
        date: filters.date,
        shiftId: filters.shiftId,
        hourId: entryForm.hourId,
        actualPicks: Number(entryForm.actualPicks),
        totalInPacked: entryForm.totalInPacked ? Number(entryForm.totalInPacked) : undefined,
        unitsLoaded: entryForm.unitsLoaded ? Number(entryForm.unitsLoaded) : undefined,
        dockHeadcount: entryForm.dockHeadcount ? Number(entryForm.dockHeadcount) : undefined,
        comments: entryForm.comments.trim() || undefined,
        createdAt: editingUpdateId ? shiftUpdates.find((item) => item.id === editingUpdateId)?.createdAt ?? now : now,
        updatedAt: now,
      }),
    );

    setEditingUpdateId(null);
    setEntryForm((current) => ({
      ...current,
      actualPicks: '',
      totalInPacked: '',
      unitsLoaded: '',
      comments: '',
    }));
  };

  const handleEditUpdate = (update: HourlyUpdate) => {
    setEditingUpdateId(update.id);
    setEntryForm({
      hourId: update.hourId,
      actualPicks: String(update.actualPicks),
      totalInPacked: update.totalInPacked ? String(update.totalInPacked) : '',
      unitsLoaded: update.unitsLoaded ? String(update.unitsLoaded) : '',
      dockHeadcount: update.dockHeadcount ? String(update.dockHeadcount) : '',
      comments: update.comments ?? '',
    });
  };

  const handleDeleteUpdate = (updateId: string) => {
    setState((current) => deleteUpdate(current, updateId));
    if (editingUpdateId === updateId) {
      setEditingUpdateId(null);
    }
  };

  const handleClearEntries = () => {
    setState((current) => clearShiftDayUpdates(current, filters.date, filters.shiftId));
    setEditingUpdateId(null);
    setEntryForm({
      hourId: selectedShift.hours[0].id,
      actualPicks: '',
      totalInPacked: '',
      unitsLoaded: '',
      dockHeadcount: filters.shiftId === 'weekend' ? '10' : '8',
      comments: '',
    });
  };

  const handleShareSnapshot = async () => {
    if (!snapshotRef.current) {
      return;
    }

    const dataUrl = await toPng(snapshotRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#0f1720',
    });
    const link = document.createElement('a');
    link.download = `dc-shift-snapshot-${filters.shiftId}-${filters.date}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'dc-shift-pace-tracker',
      version: 1,
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `dc-shift-data-${filters.shiftId}-${filters.date}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        state?: {
          plans?: ShiftPlan[];
          updates?: HourlyUpdate[];
        };
      };

      if (!parsed.state?.plans || !parsed.state?.updates) {
        window.alert('That file does not look like a valid shift backup.');
        return;
      }

      const shouldReplace = window.confirm(
        'Importing will replace the current saved shift data on this browser. Continue?',
      );

      if (!shouldReplace) {
        return;
      }

      const nextState = replaceState({
        plans: parsed.state.plans,
        updates: parsed.state.updates,
      });
      setState(nextState);
    } catch {
      window.alert('Import failed. Please choose a valid JSON backup file.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[28px] border border-white/10 bg-panel/85 px-6 py-6 shadow-panel">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-200">
                Arhaus DC
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Outbound Greatness Tracker</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Select the active shift, set the total planned volume, and compare actual picks to the
                amount of work that should be completed by the latest hourly refresh.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-shell/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest Refresh Counted</p>
              <p className="mt-2 text-lg font-semibold text-white">{latestCompletedHourLabel}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-white/10 bg-panel/85 p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Shift Setup</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Current shift selection</h2>

            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Date</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="date"
                  value={filters.date}
                  onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shift</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  value={filters.shiftId}
                  onChange={(event) => setFilters((current) => ({ ...current, shiftId: event.target.value }))}
                >
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Pick Planned Total Volume
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="number"
                  step="1"
                  value={plannedTotalInput}
                  onChange={(event) => setPlannedTotalInput(event.target.value)}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Load Planned Total Volume
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="number"
                  step="1"
                  value={plannedLoadInput}
                  onChange={(event) => setPlannedLoadInput(event.target.value)}
                />
              </label>

              <div className="grid gap-3 rounded-xl border border-white/10 bg-shell/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Break Schedule
                </p>
                {breaksInput.map((breakItem, index) => (
                  <div key={breakItem.id} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
                    <div className="rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-sm text-white">
                      {breakItem.label}
                    </div>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                      type="time"
                      value={breakItem.start}
                      onChange={(event) =>
                        setBreaksInput((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, start: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                      type="time"
                      value={breakItem.end}
                      onChange={(event) =>
                        setBreaksInput((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, end: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              <button
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
                onClick={handleSavePlan}
                type="button"
              >
                Save Shift Plan
              </button>

              <button
                className="rounded-xl border border-rose-400/25 px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10"
                onClick={handleClearEntries}
                type="button"
              >
                Clear All Entered Hours
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-shell/50 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{selectedShift.shortName}</p>
              <p className="mt-1">{selectedShift.schedule}</p>
              <p className="mt-1">{formatDisplayDate(filters.date)}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-panel/85 p-6 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Hourly Refresh Entry
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {editingUpdateId ? 'Edit hour update' : 'Enter hour result'}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Select any entered hour from the table below to load it here for editing.
                </p>
              </div>
              <StatusBadge percentToGoal={percentToNow} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Hour</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  value={entryForm.hourId}
                  onChange={(event) => setEntryForm((current) => ({ ...current, hourId: event.target.value }))}
                >
                  {selectedShift.hours.map((hour) => (
                    <option key={hour.id} value={hour.id}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Actual Picks
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="number"
                  step="1"
                  value={entryForm.actualPicks}
                  onChange={(event) => setEntryForm((current) => ({ ...current, actualPicks: event.target.value }))}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Current In Packed
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="number"
                  step="1"
                  value={entryForm.totalInPacked}
                  onChange={(event) => setEntryForm((current) => ({ ...current, totalInPacked: event.target.value }))}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Units Loaded
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="number"
                  step="1"
                  value={entryForm.unitsLoaded}
                  onChange={(event) => setEntryForm((current) => ({ ...current, unitsLoaded: event.target.value }))}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Dock Headcount
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="number"
                  step="1"
                  value={entryForm.dockHeadcount}
                  onChange={(event) => setEntryForm((current) => ({ ...current, dockHeadcount: event.target.value }))}
                />
              </label>

              <label className="space-y-2 md:col-span-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Comments
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-shell/70 px-3 py-3 text-white outline-none transition focus:border-accent"
                  type="text"
                  value={entryForm.comments}
                  onChange={(event) => setEntryForm((current) => ({ ...current, comments: event.target.value }))}
                  placeholder="Optional note about a miss, delay, or recovery."
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500"
                onClick={handleSaveUpdate}
                type="button"
              >
                {editingUpdateId ? 'Save Hour Update' : 'Add Hour Update'}
              </button>
              {editingUpdateId && (
                <button
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                  onClick={() => {
                    setEditingUpdateId(null);
                    setEntryForm({
                      hourId: selectedShift.hours[0].id,
                      actualPicks: '',
                      totalInPacked: '',
                      unitsLoaded: '',
                      dockHeadcount: filters.shiftId === 'weekend' ? '10' : '8',
                      comments: '',
                    });
                  }}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </article>
        </section>

        <div className="mt-6 flex justify-end">
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-white/10 bg-panel/80 px-5 py-3 text-sm font-semibold text-slate-100 shadow-panel transition hover:border-accent hover:text-white"
              onClick={handleExportJson}
              type="button"
            >
              Export JSON
            </button>
            <button
              className="rounded-xl border border-white/10 bg-panel/80 px-5 py-3 text-sm font-semibold text-slate-100 shadow-panel transition hover:border-accent hover:text-white"
              onClick={handleImportClick}
              type="button"
            >
              Import JSON
            </button>
            <button
              className="rounded-xl border border-white/10 bg-panel/80 px-5 py-3 text-sm font-semibold text-slate-100 shadow-panel transition hover:border-accent hover:text-white"
              onClick={handleShareSnapshot}
              type="button"
            >
              Share Snapshot
            </button>
          </div>
          <input
            ref={importInputRef}
            accept="application/json"
            className="hidden"
            onChange={handleImportJson}
            type="file"
          />
        </div>

        <div ref={snapshotRef}>
        {showVictoryBanner && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-500/12 shadow-panel">
            <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
              <img
                alt="Victory banner"
                className="h-full w-full object-cover"
                src={victoryImageUrl}
              />
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                  Crushing The Plan
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  For me life is continuously being hungry. The meaning of life is not simply to exist, to survive, but to move ahead, to go up, to achieve, to conquer.
                </h2>
                <p className="mt-2 text-sm text-emerald-50/90">{`Picked Vs Plan ${formatVariance(deltaToNow)} | Loaded Vs Plan ${formatVariance(totalLoadDeltaToNow)}`}</p>
              </div>
            </div>
          </section>
        )}
        {showFailureBanner && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-rose-400/30 bg-rose-500/12 shadow-panel">
            <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
              <img
                alt="Never give up banner"
                className="h-full w-full object-cover"
                src={failureImageUrl}
              />
              <div className="px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">
                  Digging In
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  Strength does not come from winning. Your struggles develop your strengths. When you go through hardships and decide not to surrender, that is strength.
                </h2>
                <p className="mt-2 text-sm text-rose-50/90">{`Picked Vs Plan ${formatVariance(deltaToNow)} | Loaded Vs Plan ${formatVariance(totalLoadDeltaToNow)}`}</p>
              </div>
            </div>
          </section>
        )}
        <section className="mt-6 grid gap-4 lg:grid-cols-5">
          <KpiCard
            label="Goal For Shift"
            value={`Pick: ${selectedPlan.plannedTotalVolume}\nLoad: ${selectedPlan.plannedLoadVolume}`}
            detail="Shift planned totals for pick and load"
            tone="neutral"
          />
          <KpiCard
            label="Picked Vs Plan"
            value={formatVariance(deltaToNow)}
            detail={`${formatPercent(percentToNow)} to pick plan`}
            tone={deltaToNow < 0 ? 'bad' : deltaToNow > 0 ? 'good' : 'warn'}
          />
          <KpiCard
            label="Current In Packed"
            value={String(latestPackedValue)}
            detail={`Green band: ${packedMin}-${packedMax} | Remaining to shift goal: ${remainingToGoal}`}
            tone={latestPackedValue === 0 ? 'neutral' : packedInTolerance ? 'good' : 'bad'}
          />
          <KpiCard
            label="Loaded Vs Plan"
            value={formatVariance(totalLoadDeltaToNow)}
            detail={`${formatPercent(loadedPercentToPlan)} to load plan | Shift minutes: ${totalProductiveMinutes}`}
            tone={totalLoadDeltaToNow < 0 ? 'bad' : totalLoadDeltaToNow > 0 ? 'good' : 'warn'}
          />
          <KpiCard
            label="Current Dock PPH"
            value={String(currentDockPph)}
            detail={`Total loaded ${totalLoadedToNow} / dock hours ${totalDockHoursToNow}`}
            tone="neutral"
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-panel/85 shadow-panel">
          <div className="border-b border-white/10 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Pick Pace Board</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{selectedShift.name}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Pick pacing through the latest entered completed hour for this shift.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Hour</th>
                  <th className="px-4 py-3">Prod Mins</th>
                  <th className="px-4 py-3">Expected Picks</th>
                  <th className="px-4 py-3">Actual Picks</th>
                  <th className="px-4 py-3">Delta</th>
                  <th className="px-4 py-3">Total Exp</th>
                  <th className="px-4 py-3">Total Picks</th>
                  <th className="px-4 py-3">Total Delta</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.hour.id}
                    className={`border-t border-white/5 ${
                      row.actualPicks
                        ? row.pickOnPlan
                          ? 'bg-emerald-600/35'
                          : 'bg-rose-600/35'
                        : row.isCounted
                          ? 'bg-white/5'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-4 font-semibold text-white">{row.hour.label}</td>
                    <td className="px-4 py-4">{row.productiveMinutes}</td>
                    <td className="px-4 py-4">{row.expectedPicks}</td>
                    <td className="px-4 py-4 text-lg font-semibold text-white">{row.actualPicks || ''}</td>
                    <td className={`px-4 py-4 ${row.delta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {row.actualPicks ? formatVariance(row.delta) : ''}
                    </td>
                    <td className="px-4 py-4">{row.cumulativeExpected}</td>
                    <td className="px-4 py-4">{row.cumulativePicks || ''}</td>
                    <td className={`px-4 py-4 ${row.cumulativeDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {row.cumulativePicks ? formatVariance(row.cumulativeDelta) : ''}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {row.update && (
                          <>
                            <button
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-accent hover:text-white"
                              onClick={() => handleEditUpdate(row.update!)}
                              type="button"
                            >
                              Edit Hour
                            </button>
                            <button
                              className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:bg-rose-500/10"
                              onClick={() => handleDeleteUpdate(row.update!.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-panel/85 shadow-panel">
          <div className="border-b border-white/10 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Load Pace Board</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{selectedShift.name}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Loading pace, dock productivity, and current in packed through the latest entered completed hour.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Hour</th>
                  <th className="px-4 py-3">Current In Packed</th>
                  <th className="px-4 py-3">Dock Headcount</th>
                  <th className="px-4 py-3">Expected Load</th>
                  <th className="px-4 py-3">Units Loaded</th>
                  <th className="px-4 py-3">Load Delta</th>
                  <th className="px-4 py-3">Total Load Exp</th>
                  <th className="px-4 py-3">Total Load</th>
                  <th className="px-4 py-3">Total Load Delta</th>
                  <th className="px-4 py-3">Dock PPH Hourly</th>
                  <th className="px-4 py-3">Dock PPH Shift</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.hour.id}
                    className={`border-t border-white/5 ${
                      row.unitsLoaded
                        ? row.loadOnPlan
                          ? 'bg-emerald-600/35'
                          : 'bg-rose-600/35'
                        : row.isCounted
                          ? 'bg-white/5'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-4 font-semibold text-white">{row.hour.label}</td>
                    <td
                      className={`px-4 py-4 font-semibold ${
                        row.totalInPacked
                          ? row.packedInBand
                            ? 'text-emerald-300'
                            : 'text-rose-300'
                          : ''
                      }`}
                    >
                      {row.totalInPacked || ''}
                    </td>
                    <td className="px-4 py-4">{row.dockHeadcount || ''}</td>
                    <td className="px-4 py-4">{row.expectedLoaded}</td>
                    <td className="px-4 py-4">{row.unitsLoaded || ''}</td>
                    <td className={`px-4 py-4 ${row.loadedDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {row.unitsLoaded ? formatVariance(row.loadedDelta) : ''}
                    </td>
                    <td className="px-4 py-4">{row.cumulativeLoadedExpected}</td>
                    <td className="px-4 py-4">{row.cumulativeLoaded || ''}</td>
                    <td className={`px-4 py-4 ${row.cumulativeLoadedDelta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {row.cumulativeLoaded ? formatVariance(row.cumulativeLoadedDelta) : ''}
                    </td>
                    <td className="px-4 py-4">{row.dockPphHourly || ''}</td>
                    <td className="px-4 py-4">{row.dockPphShift || ''}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {row.update && (
                          <>
                            <button
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-accent hover:text-white"
                              onClick={() => handleEditUpdate(row.update!)}
                              type="button"
                            >
                              Edit Hour
                            </button>
                            <button
                              className="rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:bg-rose-500/10"
                              onClick={() => handleDeleteUpdate(row.update!.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-panel/85 p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Break Impact</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {breaksInput.map((breakItem) => (
              <div key={breakItem.id} className="rounded-xl border border-white/10 bg-shell/50 p-4">
                <p className="font-semibold text-white">{breakItem.label}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {breakItem.start} - {breakItem.end}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-slate-300">
            {rows.map((row, index) => {
              const range = buildHourRange(filters.date, selectedShift, row.hour, selectedShift.hours[index + 1]);
              return (
                <p key={row.hour.id}>
                  {row.hour.label}: {row.productiveMinutes} productive minutes from{' '}
                  {range.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} to{' '}
                  {range.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </p>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
