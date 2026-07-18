import assert from "node:assert/strict";
import test from "node:test";
import {
  listActiveServiceOrderViews,
  serializeServiceOrder,
  serviceOrderInclude,
} from "../../lib/service-orders";

type ServiceOrderRecord = Parameters<typeof serializeServiceOrder>[0];
type ServiceOrderReadRunner = NonNullable<Parameters<typeof listActiveServiceOrderViews>[0]>;

function createOrder(): ServiceOrderRecord {
  const timestamp = new Date("2026-07-18T08:30:00.000Z");

  return {
    id: "order-1",
    orderCode: "MH-DH-001",
    customerId: "customer-1",
    userId: null,
    customerName: "Nguyen Van A",
    customerPhone: "0901234567",
    customerPhoneMissing: false,
    customerAddress: null,
    service: "DONG_PIN",
    productName: "Pin lithium",
    issueDescription: null,
    solution: null,
    status: "PENDING",
    source: "MANUAL",
    sourceName: null,
    sourceCode: null,
    sourceRow: null,
    orderDate: timestamp,
    quotedPrice: null,
    priceStatus: "PENDING_QUOTE",
    paidAmount: 0,
    paidAt: null,
    warrantyMonths: null,
    warrantyEndDate: null,
    customerVisible: false,
    contactRequestId: null,
    couponRedemptionId: null,
    couponCode: null,
    couponDiscount: null,
    discountAmount: 0,
    notes: null,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    contactRequest: null,
    couponRedemption: null,
    customer: {
      id: "customer-1",
      name: "Nguyen Van A",
      phone: "0901234567",
      address: null,
      userId: null,
    },
    user: null,
    warranty: null,
  };
}

test("active service-order projection owns filtering, relations, ordering, and serialization", async () => {
  const calls: unknown[] = [];
  const runner = {
    serviceOrder: {
      async findMany(args: unknown) {
        calls.push(args);
        return [createOrder()];
      },
    },
  } as unknown as ServiceOrderReadRunner;

  const orders = await listActiveServiceOrderViews(runner);

  assert.deepEqual(calls, [{
    where: { deletedAt: null },
    include: serviceOrderInclude,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
  }]);
  assert.equal(orders[0].createdAt, "2026-07-18T08:30:00.000Z");
  assert.equal(orders[0].orderDate, "2026-07-18T08:30:00.000Z");
  assert.equal(orders[0].status, "PENDING");
});
