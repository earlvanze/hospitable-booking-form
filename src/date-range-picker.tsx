"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canSelectArrival,
  canSelectDeparture,
  maximumBookingDate,
  type CalendarDays,
} from "./booking-calendar.js";

export type CalendarResponse = { days: CalendarDays };

type Props = {
  today: string;
  checkIn: string;
  checkOut: string;
  disabled?: boolean;
  loadMonth: (month: string, signal: AbortSignal) => Promise<CalendarResponse>;
  onDatesChange: (arrival: string, departure: string) => void;
};

const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const shiftMonth = (key: string, offset: number) => {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year, month - 1 + offset, 1)));
};
const monthLabel = (key: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00Z`));
const longDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));

export function DateRangePicker({
  today,
  checkIn,
  checkOut,
  disabled = false,
  loadMonth,
  onDatesChange,
}: Props) {
  const currentMonth = today.slice(0, 7);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [selection, setSelection] = useState<"arrival" | "departure">(
    checkIn && !checkOut ? "departure" : "arrival",
  );
  const [days, setDays] = useState<CalendarDays>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const maxDate = maximumBookingDate(today);
  const maxMonth = maxDate.slice(0, 7);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    loadMonth(visibleMonth, controller.signal)
      .then((response) => {
        if (!response || !response.days || typeof response.days !== "object")
          throw new Error("Calendar unavailable.");
        setDays((previous) => ({ ...previous, ...response.days }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Live dates could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadMonth, visibleMonth, retry]);

  const months = useMemo(
    () => [visibleMonth, shiftMonth(visibleMonth, 1)],
    [visibleMonth],
  );

  function pick(date: string) {
    if (disabled) return;
    if (selection === "arrival") {
      onDatesChange(date, "");
      setSelection("departure");
    } else {
      onDatesChange(checkIn, date);
    }
  }

  function renderMonth(key: string) {
    const [year, month] = key.split("-").map(Number);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const cells = Array.from({ length: offset + count }, (_, index) => {
      if (index < offset)
        return (
          <span
            className="booking-calendar-empty"
            key={`blank-${index}`}
            aria-hidden="true"
          />
        );
      const dayNumber = index - offset + 1;
      const date = `${key}-${String(dayNumber).padStart(2, "0")}`;
      const info = days[date];
      const isArrival = date === checkIn;
      const isDeparture = date === checkOut;
      const inRange = Boolean(
        checkIn && checkOut && date > checkIn && date < checkOut,
      );
      const selectable = Boolean(
        !loading &&
        info &&
        (selection === "arrival"
          ? canSelectArrival(date, today, maxDate, info)
          : canSelectDeparture(checkIn, date, maxDate, days)),
      );
      const label = !info
        ? `${longDate(date)}, availability not loaded`
        : !info.available
          ? `${longDate(date)}, unavailable overnight`
          : info.closedForCheckIn
            ? `${longDate(date)}, arrival unavailable`
            : `${longDate(date)}, available`;
      return (
        <button
          className={[
            "booking-calendar-day",
            !info?.available ? "is-unavailable" : "",
            info?.closedForCheckIn ? "is-arrival-closed" : "",
            isArrival || isDeparture ? "is-selected" : "",
            inRange ? "is-range" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          type="button"
          key={date}
          disabled={!selectable || disabled}
          aria-label={label}
          aria-pressed={isArrival || isDeparture}
          onClick={() => pick(date)}
        >
          {dayNumber}
        </button>
      );
    });

    return (
      <section
        className="booking-calendar-month"
        aria-label={monthLabel(key)}
        key={key}
      >
        <h4>{monthLabel(key)}</h4>
        <div className="booking-calendar-grid is-weekdays" aria-hidden="true">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="booking-calendar-grid">{cells}</div>
      </section>
    );
  }

  return (
    <div
      className="booking-date-picker"
      role="group"
      aria-label="Choose arrival and departure dates"
    >
      <div className="booking-date-fields" aria-label="Selected stay dates">
        <button
          type="button"
          className={selection === "arrival" ? "is-active" : ""}
          aria-pressed={selection === "arrival"}
          onClick={() => setSelection("arrival")}
          disabled={disabled}
        >
          <span>Arrival</span>
          <strong>{checkIn ? longDate(checkIn) : "Choose a date"}</strong>
        </button>
        <button
          type="button"
          className={selection === "departure" ? "is-active" : ""}
          aria-pressed={selection === "departure"}
          onClick={() => setSelection("departure")}
          disabled={disabled || !checkIn}
        >
          <span>Departure</span>
          <strong>{checkOut ? longDate(checkOut) : "Choose a date"}</strong>
        </button>
      </div>
      <div className="booking-calendar-nav">
        <p aria-live="polite">
          {loading
            ? "Loading live dates…"
            : loadError
              ? "Live dates are unavailable."
              : selection === "arrival"
                ? "Choose an available arrival date."
                : "Choose a departure date; booked nights are marked."}
        </p>
        <div>
          <button
            type="button"
            aria-label="Show previous month"
            disabled={disabled || loading || visibleMonth <= currentMonth}
            onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Show next month"
            disabled={disabled || loading || visibleMonth >= maxMonth}
            onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>
      </div>
      {loadError ? (
        <div className="booking-calendar-error" role="status">
          <p>{loadError}</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRetry((n) => n + 1)}
          >
            Reload dates
          </button>
        </div>
      ) : (
        <div className="booking-calendar-months" aria-busy={loading}>
          {months.map(renderMonth)}
        </div>
      )}
      <div className="booking-calendar-legend">
        <span>
          <i className="is-open" /> Available
        </span>
        <span>
          <i className="is-closed" /> Unavailable overnight
        </span>
        <span>
          <i className="is-restricted" /> No arrivals
        </span>
      </div>
    </div>
  );
}
