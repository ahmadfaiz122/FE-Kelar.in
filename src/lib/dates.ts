const TIME_ZONE = "Asia/Jakarta";

function wibDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

export function addBusinessDays(start: Date, days: number, weekdays: number[] = [1, 2, 3, 4, 5]) {
  const { year, month, day } = wibDateParts(start);
  let cursor = new Date(Date.UTC(year, month - 1, day));
  let remaining = Math.max(0, Math.trunc(days));
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (weekdays.includes(cursor.getUTCDay())) remaining -= 1;
  }
  // Jam tutup layanan pukul 17.00 WIB (UTC+7); simpan sebagai instant UTC.
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 10, 0, 0));
}

export function addPriorityHours(start: Date, hours: number) {
  return new Date(start.getTime() + Math.max(1, hours) * 60 * 60 * 1000);
}

export function formatWib(value: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Belum dimulai";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatWibDay(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function isLate(dueAt: Date | string | null, completedAt?: Date | string | null) {
  if (!dueAt) return false;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const complete = completedAt ? (typeof completedAt === "string" ? new Date(completedAt) : completedAt) : null;
  return (complete ?? new Date()).getTime() > due.getTime();
}

export function relativeWib(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const delta = Date.now() - date.getTime();
  const hours = Math.floor(delta / 3_600_000);
  if (hours < 1) return "Baru saja";
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: TIME_ZONE }).format(date);
}
