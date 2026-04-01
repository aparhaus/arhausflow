# DC Shift Pace Tracker

Simple internal MVP for a distribution center team that wants to replace an Excel pace sheet with a focused web app.

## What This Version Does

This version is built around one active shift at a time.

Leaders:

- choose the date and shift
- enter the total planned volume for the shift
- review or adjust 1st break, 2nd break, and 3rd break where applicable
- enter hourly actual picks as the refresh comes in
- optionally enter units loaded and dock headcount
- save the hour that just completed

The app then:

- allocates the shift plan across productive minutes by hour
- calculates expected picks by hour
- calculates cumulative expected and cumulative actual
- only counts rows through the latest completed entered hour
- automatically removes break minutes from the affected hour buckets

Example:

- if a leader enters the `22:00` hour and marks the update `as of 11:05 PM`
- the app counts progress through the hour ending at `11:00 PM`
- so the summary compares actual vs expected only through that point in the shift

## Architecture

The app is split into small layers so it stays easy to customize:

- `src/config`
  Shift definitions, hourly buckets, default break templates, default shift goals, and status thresholds.
- `src/types`
  Shared TypeScript models for shift plans and hourly updates.
- `src/services`
  `localStorage` persistence for shift plans and hourly update rows.
- `src/utils`
  Date helpers, expected-volume allocation, cumulative math, and timestamp cutoff logic.
- `src/components`
  Reusable KPI cards and status badges.
- `src/data`
  Seed plans and sample hourly updates.

## Current Screen Design

The main page is intentionally simple:

- Shift setup panel
- Hourly refresh entry panel
- Summary KPI cards
- One spreadsheet-style hourly pace table for the selected shift

It also includes:

- `Clear All Entered Hours` for the selected shift/date so the team can restart the day quickly
- `Edit Hour` actions in the table so already-entered rows can be corrected

It does not show all 3 shifts at once. The user selects the current shift and works only in that view.

## File Structure

```text
dc-performance-tracker/
├── src/
│   ├── components/
│   ├── config/
│   ├── data/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## How To Run

```bash
cd "/Users/anth/Library/Mobile Documents/com~apple~CloudDocs/AI Stuff/dc-performance-tracker"
npm install
npm run dev
```

## How To Change Shift Times Or % Work

Open:

- `src/config/operationsConfig.ts`

Each shift has a configurable `hours` array and `defaultBreaks` array:

```ts
['22:00', 22, 0]
```

Format:

- display label
- 24-hour clock hour
- minute

Breaks are configured like:

```ts
{ id: 'break-1', label: '1st Break', start: '20:00', end: '20:15' }
```

## How To Change Default Shift Goals

Open:

- `src/config/operationsConfig.ts`

Then update:

```ts
export const defaultPlannedTotals = {
  day: 1500,
  night: 1205,
  weekend: 1750,
};
```

## How The Pace Logic Works

The main calculation helpers are in:

- `src/utils/metrics.ts`

Key rules:

- `Expected Picks` = shift goal allocated across productive minutes
- `Delta` = actual picks - expected picks
- `Cumulative Delta` = cumulative actual - cumulative expected
- summary cards use only rows through the latest hour that has been entered
- break windows subtract minutes from the affected hours before expected volume is allocated

## How To Connect A Real Backend Later

The easiest upgrade path is:

1. Replace `src/services/storage.ts` with API calls
2. Keep `plans` and `updates` as separate resources
3. Store shift config centrally if you want shared control
4. Add user logins and audit history
5. Add exports or leadership summaries from the same derived table model

## Suggested Next Steps

- Add separate planned loaded volume alongside planned picks
- Add an hourly “notes and actions” field visible on the board
- Add a lock for completed hours
- Add a daily leadership summary card
- Add CSV export of the active shift board
