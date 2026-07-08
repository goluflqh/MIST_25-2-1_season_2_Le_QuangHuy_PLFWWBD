export type MinhHongImportScope = "all" | "service-orders" | "partners";

export function normalizeMinhHongImportScope(value: string | null | undefined): MinhHongImportScope | null {
  const scope = String(value || "all").toLowerCase();
  if (scope === "all" || scope === "full") return "all";
  if (scope === "service-orders" || scope === "customer-orders" || scope === "orders") return "service-orders";
  if (scope === "partners" || scope === "partner-ledger" || scope === "doi-tac") return "partners";
  return null;
}
