/**
 * Utility functions to format date and time according to browser's locale and timezone.
 * Passing `undefined` to Intl / toLocaleString uses the user's browser default locale and local timezone.
 */

/**
 * Parses date safely.
 * SQLite's `CURRENT_TIMESTAMP` stores UTC dates as "YYYY-MM-DD HH:MM:SS" without a timezone specifier ('Z' or offset).
 * Standard JavaScript `new Date("YYYY-MM-DD HH:MM:SS")` mistakenly interprets strings without 'Z' as local time,
 * which caused dates to look like UTC/GMT 0 instead of converting to the browser's local timezone.
 * We normalize UTC strings by appending 'Z' so the browser accurately converts to the local timezone.
 */
export function parseDate(dateInput?: string | number | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  let str = String(dateInput).trim();
  if (!str) return null;

  // Match SQLite CURRENT_TIMESTAMP "YYYY-MM-DD HH:mm:ss" or ISO without timezone offset/Z
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDate(dateInput);
  if (!d) return '';
  return d.toLocaleString(undefined, options);
}

export function formatTime(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDate(dateInput);
  if (!d) return '';
  return d.toLocaleTimeString(undefined, options);
}

export function formatDate(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseDate(dateInput);
  if (!d) return '';
  return d.toLocaleDateString(undefined, options);
}
