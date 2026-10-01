export type CalendarDay = {
  available: boolean;
  minimumStay: number;
  closedForCheckIn: boolean;
  closedForCheckOut: boolean;
};

export type CalendarDays = Record<string, CalendarDay>;

export function maximumBookingDate(today: string) {
  return new Date(Date.parse(`${today}T00:00:00Z`) + 731 * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function canSelectArrival(
  date: string,
  today: string,
  latest: string,
  day: CalendarDay | undefined,
) {
  return Boolean(
    day?.available && !day.closedForCheckIn && date >= today && date <= latest,
  );
}

export function canSelectDeparture(
  checkIn: string,
  date: string,
  latest: string,
  days: CalendarDays,
) {
  const departure = days[date];
  if (
    !checkIn ||
    !departure ||
    date <= checkIn ||
    date > latest ||
    departure.closedForCheckOut
  )
    return false;

  const nights =
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) /
    86400000;
  if (nights < (days[checkIn]?.minimumStay ?? 1) || nights > 90) return false;

  for (
    let stamp = Date.parse(`${checkIn}T00:00:00Z`);
    stamp < Date.parse(`${date}T00:00:00Z`);
    stamp += 86400000
  ) {
    const night = new Date(stamp).toISOString().slice(0, 10);
    if (days[night]?.available !== true) return false;
  }
  return true;
}
