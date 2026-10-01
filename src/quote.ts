export type PaymentTerm = {
  amountCents: number;
  dueAt?: string;
};

export type BookingQuote = {
  currency: string;
  totalCents: number;
  bookingUrl: string;
  nights: number;
  paymentTerms: PaymentTerm[];
};

/** Validate the normalized quote sent by your server adapter.
 * An empty payment schedule is valid; Hospitable can present payment timing
 * during its hosted checkout. Populated schedules must reconcile to the total.
 */
export function normalizeQuote(
  value: unknown,
  checkoutHost = "booking.hospitable.com",
): BookingQuote {
  if (!value || typeof value !== "object") throw new Error("Invalid quote.");
  const quote = value as Record<string, unknown>;
  if (
    typeof quote.currency !== "string" ||
    !/^[A-Z]{3}$/.test(quote.currency) ||
    !Number.isSafeInteger(quote.totalCents) ||
    Number(quote.totalCents) < 1 ||
    !Number.isSafeInteger(quote.nights) ||
    Number(quote.nights) < 1 ||
    typeof quote.bookingUrl !== "string"
  )
    throw new Error("Invalid quote.");

  let url: URL;
  try {
    url = new URL(quote.bookingUrl);
  } catch {
    throw new Error("Invalid checkout URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== checkoutHost ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith("/book/")
  )
    throw new Error("Invalid checkout URL.");

  const rawTerms = quote.paymentTerms;
  if (rawTerms !== undefined && !Array.isArray(rawTerms))
    throw new Error("Invalid payment terms.");
  const paymentTerms = (rawTerms ?? []) as PaymentTerm[];
  let scheduledCents = 0;
  for (const term of paymentTerms) {
    if (
      !term ||
      !Number.isSafeInteger(term.amountCents) ||
      term.amountCents < 1 ||
      (term.dueAt !== undefined &&
        (typeof term.dueAt !== "string" ||
          !Number.isFinite(Date.parse(term.dueAt))))
    )
      throw new Error("Invalid payment terms.");
    scheduledCents += term.amountCents;
  }
  if (paymentTerms.length && scheduledCents !== quote.totalCents)
    throw new Error("Payment schedule does not match quote total.");

  return {
    currency: quote.currency,
    totalCents: Number(quote.totalCents),
    bookingUrl: url.toString(),
    nights: Number(quote.nights),
    paymentTerms,
  };
}
