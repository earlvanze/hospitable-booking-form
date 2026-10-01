import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  canSelectArrival,
  canSelectDeparture,
} from "../src/booking-calendar.js";
import { HospitableBookingForm } from "../src/hospitable-booking-form.js";
import { normalizeQuote } from "../src/quote.js";

test("arrival requires an open night and an allowed check-in", () => {
  const open = {
    available: true,
    minimumStay: 2,
    closedForCheckIn: false,
    closedForCheckOut: false,
  };
  assert.equal(
    canSelectArrival("2026-11-20", "2026-10-01", "2028-10-01", open),
    true,
  );
  assert.equal(
    canSelectArrival("2026-11-20", "2026-10-01", "2028-10-01", {
      ...open,
      closedForCheckIn: true,
    }),
    false,
  );
});

test("departure enforces minimum nights and availability throughout the stay", () => {
  const open = {
    available: true,
    minimumStay: 3,
    closedForCheckIn: false,
    closedForCheckOut: false,
  };
  const days = {
    "2026-11-20": open,
    "2026-11-21": open,
    "2026-11-22": open,
    "2026-11-23": open,
    "2026-11-24": open,
  };
  assert.equal(
    canSelectDeparture("2026-11-20", "2026-11-22", "2028-10-01", days),
    false,
  );
  assert.equal(
    canSelectDeparture("2026-11-20", "2026-11-23", "2028-10-01", days),
    true,
  );
  assert.equal(
    canSelectDeparture("2026-11-20", "2026-11-23", "2028-10-01", {
      ...days,
      "2026-11-21": { ...open, available: false },
    }),
    false,
  );
});

test("booking form cannot be submitted before both dates are selected", () => {
  const html = renderToStaticMarkup(
    React.createElement(HospitableBookingForm, {
      maxGuests: 8,
      loadMonth: async () => ({ days: {} }),
      checkAvailability: async () => ({ available: false }),
      getQuote: async () => ({}),
    }),
  );
  assert.match(html, /disabled=""[^>]*>Choose your dates above/);
});

test("quote accepts a missing payment schedule", () => {
  const quote = normalizeQuote({
    currency: "USD",
    totalCents: 50000,
    nights: 3,
    bookingUrl: "https://booking.hospitable.com/book/example",
  });
  assert.deepEqual(quote.paymentTerms, []);
});

test("quote rejects totals or populated schedules that cannot be reconciled", () => {
  const base = {
    currency: "USD",
    totalCents: 50000,
    nights: 3,
    bookingUrl: "https://booking.hospitable.com/book/example",
  };
  assert.throws(
    () => normalizeQuote({ ...base, totalCents: 0 }),
    /Invalid quote/,
  );
  assert.throws(
    () => normalizeQuote({ ...base, paymentTerms: [{ amountCents: 10000 }] }),
    /does not match/,
  );
  assert.throws(
    () =>
      normalizeQuote({
        ...base,
        bookingUrl: "https://example.com/book/example",
      }),
    /checkout URL/,
  );
});
