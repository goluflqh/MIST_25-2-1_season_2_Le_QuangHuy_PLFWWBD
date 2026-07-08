export interface ServiceOrderFinancialInput {
  discountAmount?: number | null;
  paidAmount?: number | null;
  priceStatus?: string | null;
  quotedPrice?: number | null;
}

export interface PartnerEntryFinancialInput {
  amount: number;
  countsInDebt?: boolean | null;
  entryType: string;
}

function nonNegativeMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

export function getServiceOrderPayableAmount(order: ServiceOrderFinancialInput) {
  return Math.max(nonNegativeMoney(order.quotedPrice) - nonNegativeMoney(order.discountAmount), 0);
}

export function getServiceOrderReceivableDebt(order: ServiceOrderFinancialInput) {
  if (order.priceStatus !== "CONFIRMED") return 0;
  return Math.max(getServiceOrderPayableAmount(order) - nonNegativeMoney(order.paidAmount), 0);
}

export function calculateServiceOrderFinancials(order: ServiceOrderFinancialInput) {
  const quoted = nonNegativeMoney(order.quotedPrice);
  const discount = nonNegativeMoney(order.discountAmount);
  const payable = getServiceOrderPayableAmount(order);
  const paid = nonNegativeMoney(order.paidAmount);

  return {
    debt: getServiceOrderReceivableDebt(order),
    discount,
    overpaid: Math.max(paid - payable, 0),
    paid,
    payable,
    quoted,
  };
}

export function summarizeServiceOrderFinancials<T extends ServiceOrderFinancialInput>(orders: T[]) {
  return orders.reduce(
    (summary, order) => {
      const financials = calculateServiceOrderFinancials(order);
      summary.debt += financials.debt;
      summary.discount += financials.discount;
      summary.overpaid += financials.overpaid;
      summary.paid += financials.paid;
      summary.payable += financials.payable;
      summary.quoted += financials.quoted;
      if (financials.debt > 0) summary.debtOrders += 1;
      return summary;
    },
    { debt: 0, debtOrders: 0, discount: 0, overpaid: 0, paid: 0, payable: 0, quoted: 0 }
  );
}

export function getPartnerEntrySignedAmount(entry: PartnerEntryFinancialInput) {
  if (entry.countsInDebt === false) return 0;

  if (entry.entryType === "PAYMENT" || entry.entryType === "RETURN") {
    return -Math.abs(entry.amount);
  }

  if (entry.entryType === "ADJUSTMENT") {
    return entry.amount;
  }

  return Math.abs(entry.amount);
}

export function getPartnerBalance(entries: PartnerEntryFinancialInput[]) {
  return entries.reduce((sum, entry) => sum + getPartnerEntrySignedAmount(entry), 0);
}

export function summarizePartnerLedgerEntries<T extends PartnerEntryFinancialInput>(entries: T[]) {
  return entries.reduce(
    (summary, entry) => {
      const signedAmount = getPartnerEntrySignedAmount(entry);

      if (entry.entryType === "OPENING_BALANCE") summary.openingBalance += entry.amount;
      if (entry.entryType === "PURCHASE") summary.purchased += entry.amount;
      if (entry.entryType === "PAYMENT") summary.paid += entry.amount;
      if (entry.entryType === "RETURN") summary.returned += entry.amount;
      if (entry.entryType === "ADJUSTMENT") summary.adjusted += signedAmount;

      if (entry.countsInDebt === false) {
        summary.referenceOnly += entry.amount;
      } else {
        if (entry.entryType === "OPENING_BALANCE") summary.countedOpeningBalance += entry.amount;
        if (entry.entryType === "PURCHASE") summary.countedPurchased += entry.amount;
        if (entry.entryType === "PAYMENT") summary.countedPaid += entry.amount;
        if (entry.entryType === "RETURN") summary.countedReturned += entry.amount;
        if (entry.entryType === "ADJUSTMENT") summary.countedAdjusted += signedAmount;
      }

      if (signedAmount > 0) summary.increase += signedAmount;
      if (signedAmount < 0) summary.decrease += Math.abs(signedAmount);
      return summary;
    },
    {
      adjusted: 0,
      countedAdjusted: 0,
      countedOpeningBalance: 0,
      countedPaid: 0,
      countedPurchased: 0,
      countedReturned: 0,
      decrease: 0,
      increase: 0,
      openingBalance: 0,
      paid: 0,
      purchased: 0,
      referenceOnly: 0,
      returned: 0,
    }
  );
}
