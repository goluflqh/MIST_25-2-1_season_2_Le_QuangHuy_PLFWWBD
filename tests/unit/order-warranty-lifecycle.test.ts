import assert from "node:assert/strict";
import test from "node:test";
import { reconcileOrderWarrantyLifecycle } from "../../lib/order-warranty-lifecycle";

type OrderState = {
  customer: { userId: string | null };
  customerName: string;
  customerPhone: string;
  deletedAt: Date | null;
  id: string;
  orderCode: string;
  orderDate: Date;
  productName: string;
  service: string;
  status: string;
  userId: string | null;
  warrantyEndDate: Date | null;
  warrantyMonths: number | null;
};

type WarrantyState = {
  customerName: string;
  customerPhone: string;
  deletedAt: Date | null;
  endDate: Date;
  id: string;
  notes: string | null;
  productName: string;
  serialNo: string;
  service: string;
  serviceOrderId: string;
  startDate: Date;
  userId: string | null;
};

function createState(overrides: Partial<OrderState> = {}, warranty: WarrantyState | null = null) {
  return {
    order: {
      customer: { userId: null },
      customerName: "Nguyen Van A",
      customerPhone: "0901234567",
      deletedAt: null,
      id: "order-1",
      orderCode: "MH-DH-001",
      orderDate: new Date("2026-07-01T00:00:00.000Z"),
      productName: "Pin lithium",
      service: "DONG_PIN",
      status: "COMPLETED",
      userId: null,
      warrantyEndDate: null,
      warrantyMonths: 6,
      ...overrides,
    },
    warranty,
  };
}

function createWarranty(overrides: Partial<WarrantyState> = {}): WarrantyState {
  return {
    customerName: "Nguyen Van A",
    customerPhone: "0901234567",
    deletedAt: null,
    endDate: new Date("2027-01-01T23:59:59.999Z"),
    id: "warranty-1",
    notes: "Ghi chu cu",
    productName: "Pin lithium",
    serialNo: "MH-BH-001",
    service: "DONG_PIN",
    serviceOrderId: "order-1",
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    userId: null,
    ...overrides,
  };
}

function createRunner(state: ReturnType<typeof createState>) {
  const runner = {
    serviceOrder: {
      async findUnique() {
        return {
          ...state.order,
          warranty: state.warranty
            ? { deletedAt: state.warranty.deletedAt, id: state.warranty.id }
            : null,
        };
      },
      async update({ data }: { data: Record<string, unknown> }) {
        state.order = { ...state.order, ...data } as OrderState;
        return state.order;
      },
    },
    warranty: {
      async create({ data }: { data: Omit<WarrantyState, "id"> }) {
        state.warranty = { id: "warranty-created", ...data };
        return state.warranty;
      },
      async findUnique({ where }: { where: Record<string, string> }) {
        if (!state.warranty) return null;
        if (where.id && where.id !== state.warranty.id) return null;
        if (where.serialNo && where.serialNo !== state.warranty.serialNo) return null;
        if (where.serviceOrderId && where.serviceOrderId !== state.warranty.serviceOrderId) return null;
        return state.warranty;
      },
      async update({ data }: { data: Partial<WarrantyState> }) {
        if (!state.warranty) throw new Error("Warranty not found");
        state.warranty = { ...state.warranty, ...data };
        return state.warranty;
      },
    },
  };

  return runner as unknown as Parameters<typeof reconcileOrderWarrantyLifecycle>[0];
}

test("creates a warranty when an eligible completed order has none", async () => {
  const state = createState();

  const audit = await reconcileOrderWarrantyLifecycle(createRunner(state), state.order.id);

  assert.equal(audit?.action, "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER");
  assert.equal(state.warranty?.serviceOrderId, state.order.id);
  assert.ok(state.order.warrantyEndDate instanceof Date);
});

test("refreshes the active warranty through one lifecycle interface", async () => {
  const state = createState(
    { orderDate: new Date("2026-08-01T00:00:00.000Z") },
    createWarranty()
  );

  const audit = await reconcileOrderWarrantyLifecycle(createRunner(state), state.order.id, {
    refreshActiveWarranty: true,
    startDate: state.order.orderDate,
  });

  assert.equal(audit?.action, "WARRANTY_AUTO_UPDATE_FROM_SERVICE_ORDER");
  assert.equal(state.warranty?.notes, "Ghi chu cu");
  assert.equal(state.warranty?.startDate.toISOString(), state.order.orderDate.toISOString());
});

test("archives an active warranty when the order is no longer completed", async () => {
  const state = createState({ status: "IN_PROGRESS" }, createWarranty());

  const audit = await reconcileOrderWarrantyLifecycle(createRunner(state), state.order.id);

  assert.equal(audit?.action, "WARRANTY_AUTO_ARCHIVE_FROM_SERVICE_ORDER");
  assert.ok(state.warranty?.deletedAt instanceof Date);
  assert.equal(state.order.warrantyEndDate, null);
});

test("clears a stale warranty end date even when there is no warranty row", async () => {
  const state = createState({
    status: "CANCELLED",
    warrantyEndDate: new Date("2027-01-01T23:59:59.999Z"),
  });

  const audit = await reconcileOrderWarrantyLifecycle(createRunner(state), state.order.id);

  assert.equal(audit, null);
  assert.equal(state.order.warrantyEndDate, null);
});

test("does not restore an explicitly archived warranty", async () => {
  const archivedAt = new Date("2026-07-10T00:00:00.000Z");
  const state = createState({}, createWarranty({ deletedAt: archivedAt }));

  const audit = await reconcileOrderWarrantyLifecycle(createRunner(state), state.order.id, {
    refreshActiveWarranty: true,
  });

  assert.equal(audit, null);
  assert.equal(state.warranty?.deletedAt, archivedAt);
});

test("does not change an active warranty when a completed order has zero warranty months", async () => {
  const warranty = createWarranty();
  const state = createState({ warrantyMonths: 0 }, warranty);

  const audit = await reconcileOrderWarrantyLifecycle(createRunner(state), state.order.id, {
    refreshActiveWarranty: true,
  });

  assert.equal(audit, null);
  assert.equal(state.warranty?.deletedAt, null);
  assert.equal(state.warranty?.endDate, warranty.endDate);
});
