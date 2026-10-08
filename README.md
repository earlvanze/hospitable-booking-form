# Hospitable Booking Form

A reusable React date picker and booking form for a direct-booking site that
uses Hospitable for calendar availability, pricing, and hosted checkout. The
form keeps **Check availability** disabled until both arrival and departure
dates are selected. It also accepts a valid quote with no payment schedule;
Hospitable can show payment timing in hosted checkout.

This repo contains the guest-facing UI and integration contracts. Your own
server routes must connect to Hospitable and validate availability, quote
amounts, and checkout URLs. The browser never receives a Hospitable API token.

## Contents

- `DateRangePicker`: two-month calendar with arrival/departure selection,
  minimum-night rules, unavailable nights, and check-in/check-out restrictions.
- `HospitableBookingForm`: date and guest form with availability, quote, and
  hosted-checkout callbacks.
- `normalizeQuote`: validates the normalized quote contract and permits an
  absent or empty payment schedule while requiring populated schedules to match
  the quote total.
- `booking-form.css`: responsive styles with overridable `--booking-*` tokens.

## Install in an existing React app

Copy `src/` into the app, install React, and import the stylesheet:

```tsx
import {
  HospitableBookingForm,
  type BookingFormProps,
} from "./booking-form/hospitable-booking-form";
import "./booking-form/booking-form.css";

const loadMonth: BookingFormProps["loadMonth"] = async (month, signal) => {
  const response = await fetch(`/api/calendar?month=${month}`, { signal });
  if (!response.ok) throw new Error("Live dates could not be loaded.");
  return response.json();
};

const checkAvailability: BookingFormProps["checkAvailability"] = async (
  request,
  signal,
) => {
  const params = new URLSearchParams({
    checkIn: request.checkIn,
    checkOut: request.checkOut,
    guests: String(request.guests),
  });
  const response = await fetch(`/api/availability?${params}`, { signal });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "Try another date range.");
  return data;
};

const getQuote: BookingFormProps["getQuote"] = async (request, signal) => {
  const response = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "Pricing is unavailable.");
  return data;
};

export function Booking() {
  return (
    <HospitableBookingForm
      maxGuests={10}
      maxPets={2}
      initialAdults={2}
      timeZone="America/Los_Angeles"
      loadMonth={loadMonth}
      checkAvailability={checkAvailability}
      getQuote={getQuote}
      showPromoInput
    />
  );
}
```

Wrap callback functions in `useCallback` if they are declared inside a React
component, so the calendar does not reload when the parent rerenders.

## Expected API contracts

The calendar loader returns the month’s dates in this shape:

```json
{
  "days": {
    "2026-11-20": {
      "available": true,
      "minimumStay": 3,
      "closedForCheckIn": false,
      "closedForCheckOut": false
    }
  }
}
```

`checkAvailability` receives `{ checkIn, checkOut, guests, adults, children,
infants, pets, promoCode? }` and returns `{ available, minimumStay?, message? }`. `getQuote`
receives the same request and returns a server-validated quote. Set `showPromoInput`
to render the optional field; an empty code is omitted and changing it clears any
previous availability result and quote:

```json
{
  "currency": "USD",
  "totalCents": 50000,
  "nights": 3,
  "bookingUrl": "https://booking.hospitable.com/book/example",
  "paymentTerms": []
}
```

`paymentTerms` may be omitted or empty. Do not reject a quote for that reason,
and do not invent a payment schedule. When terms are supplied, each amount must
be a positive integer in cents and the scheduled amounts must add up to the
quote total. `normalizeQuote` enforces those UI contract checks. Your server
adapter must also validate the raw Hospitable response, including its total,
fees, taxes, currency, and hosted checkout URL; never trust browser-supplied
prices to create a reservation or payment. For Hospitable adapters, send a
validated non-empty `promoCode` as `promo_code` to the authenticated Direct API
(or `promotion` to the public widget quote API); never accept a discount claim
without the provider’s fresh quote.

## LunaDome integration note

LunaDome currently uses Hospitable’s hosted booking widget. The date picker and
submit behavior inside that iframe belong to Hospitable. This form is for a
custom booking flow that calls LunaDome-owned server routes; those routes can
adapt the calendar and quote endpoints without exposing Hospitable credentials
in browser code.

## Development

```sh
npm install
npm test
npm run typecheck
```

The UI uses React as a peer dependency and has no property imagery, branding,
property identifiers, payment credentials, or production service URLs.
