export const toIsoDate = (value: Date): string => value.toISOString().split('T')[0];

export const todayIso = (): string => toIsoDate(new Date());

export const subDaysIso = (daysBack: number): string => {
  const value = new Date();
  value.setDate(value.getDate() - daysBack);
  return toIsoDate(value);
};

export const toDateTimeLocalValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const formatDisplayDate = (isoDate: string): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));

export const formatDisplayDateTime = (dateTime?: string): string =>
  dateTime
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(dateTime))
    : 'No updates yet';
