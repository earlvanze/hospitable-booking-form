"use client";

import { useRef, useState } from "react";
import { DateRangePicker } from "./date-range-picker.js";
import { normalizeQuote, type BookingQuote } from "./quote.js";
import type { CalendarResponse } from "./date-range-picker.js";

export type StayRequest = {
  checkIn: string;
  checkOut: string;
  guests: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  promoCode?: string;
};

export type AvailabilityResult = {
  available: boolean;
  minimumStay?: number;
  message?: string;
};

export type BookingFormProps = {
  maxGuests: number;
  maxPets?: number;
  initialAdults?: number;
  timeZone?: string;
  loadMonth: (month: string, signal: AbortSignal) => Promise<CalendarResponse>;
  checkAvailability: (
    request: StayRequest,
    signal: AbortSignal,
  ) => Promise<AvailabilityResult>;
  getQuote: (request: StayRequest, signal: AbortSignal) => Promise<unknown>;
  checkoutHost?: string;
  /** Show an optional promo-code field and include it in quote requests. */
  showPromoInput?: boolean;
};

function localToday(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function HospitableBookingForm({
  maxGuests,
  maxPets = 2,
  initialAdults = 2,
  timeZone = "America/New_York",
  loadMonth,
  checkAvailability,
  getQuote,
  checkoutHost = "booking.hospitable.com",
  showPromoInput = false,
}: BookingFormProps) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(() =>
    Math.max(1, Math.min(initialAdults, maxGuests)),
  );
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const pending = useRef<AbortController | null>(null);
  const today = localToday(timeZone);
  const guests = adults + children + infants;

  function updateDates(arrival: string, departure: string) {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setCheckIn(arrival);
    setCheckOut(departure);
    setError("");
    setResult(null);
    setQuote(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkIn || !checkOut || busy) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const request = {
      checkIn,
      checkOut,
      guests,
      adults,
      children,
      infants,
      pets,
      ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
    };
    setBusy(true);
    setError("");
    setResult(null);
    setQuote(null);
    try {
      const availability = await checkAvailability(request, controller.signal);
      if (controller.signal.aborted) return;
      setResult(availability);
      if (!availability.available) return;
      const rawQuote = await getQuote(request, controller.signal);
      if (controller.signal.aborted) return;
      setQuote(normalizeQuote(rawQuote, checkoutHost));
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(
          caught instanceof Error ? caught.message : "Please try again.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <section
      className="hospitable-booking-form"
      aria-labelledby="booking-form-title"
    >
      <h2 id="booking-form-title">Check availability</h2>
      <form onSubmit={submit}>
        <DateRangePicker
          today={today}
          checkIn={checkIn}
          checkOut={checkOut}
          disabled={busy}
          loadMonth={loadMonth}
          onDatesChange={updateDates}
        />
        <div className="booking-party-fields">
          <label className="booking-guests">
            Adults
            <select
              value={adults}
              disabled={busy}
              onChange={(event) => {
                setAdults(Number(event.target.value));
                setResult(null);
                setQuote(null);
              }}
            >
              {Array.from(
                { length: Math.max(1, maxGuests - children - infants) },
                (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="booking-guests">
            Children
            <select
              value={children}
              disabled={busy}
              onChange={(event) => {
                setChildren(Number(event.target.value));
                setResult(null);
                setQuote(null);
              }}
            >
              {Array.from(
                { length: Math.max(0, maxGuests - adults - infants + 1) },
                (_, index) => (
                  <option key={index} value={index}>
                    {index}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="booking-guests">
            Infants
            <select
              value={infants}
              disabled={busy}
              onChange={(event) => {
                setInfants(Number(event.target.value));
                setResult(null);
                setQuote(null);
              }}
            >
              {Array.from(
                { length: Math.max(0, maxGuests - adults - children + 1) },
                (_, index) => (
                  <option key={index} value={index}>
                    {index}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="booking-guests">
            Pets
            <select
              value={pets}
              disabled={busy}
              onChange={(event) => setPets(Number(event.target.value))}
            >
              {Array.from({ length: maxPets + 1 }, (_, index) => (
                <option key={index} value={index}>
                  {index === 0 ? "No pets" : index}
                </option>
              ))}
            </select>
          </label>
        </div>
        {showPromoInput && (
          <label className="booking-promo">
            Promo code (optional)
            <input
              type="text"
              value={promoCode}
              disabled={busy}
              maxLength={100}
              autoCapitalize="characters"
              autoCorrect="off"
              onChange={(event) => {
                setPromoCode(event.target.value);
                setResult(null);
                setQuote(null);
              }}
            />
          </label>
        )}
        <button
          className="booking-submit"
          type="submit"
          disabled={busy || !checkIn || !checkOut}
        >
          {busy
            ? "Checking your dates…"
            : checkIn && checkOut
              ? "Check availability"
              : "Choose your dates above"}
        </button>
      </form>
      <div aria-live="polite">
        {error && (
          <p className="booking-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <div className="booking-result" role="status">
            <strong>
              {result.available
                ? "Your dates are open."
                : "Those dates are unavailable."}
            </strong>
            {result.message && <p>{result.message}</p>}
            {result.minimumStay && result.minimumStay > 1 && (
              <p>Minimum stay: {result.minimumStay} nights.</p>
            )}
          </div>
        )}
        {quote && (
          <section className="booking-quote" aria-label="Stay quote">
            <p className="booking-quote-label">LIVE BOOKING PRICE</p>
            <strong>{money(quote.totalCents, quote.currency)}</strong>
            <p>
              {quote.nights} {quote.nights === 1 ? "night" : "nights"}.
            </p>
            {quote.paymentTerms.length ? (
              <ul>
                {quote.paymentTerms.map((term, index) => (
                  <li key={`${term.dueAt ?? "booking"}-${index}`}>
                    {money(term.amountCents, quote.currency)}
                    {term.dueAt
                      ? ` due ${new Date(term.dueAt).toLocaleDateString()}`
                      : " due at booking"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Hospitable will show payment timing in secure checkout.</p>
            )}
            <a className="booking-checkout" href={quote.bookingUrl}>
              Continue to Hospitable checkout ↗
            </a>
          </section>
        )}
      </div>
    </section>
  );
}
