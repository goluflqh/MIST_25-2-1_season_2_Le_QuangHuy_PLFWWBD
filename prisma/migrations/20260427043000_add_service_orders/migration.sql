-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerAddress" TEXT,
    "service" TEXT NOT NULL DEFAULT 'KHAC',
    "productName" TEXT NOT NULL,
    "issueDescription" TEXT,
    "solution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotedPrice" INTEGER,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "warrantyMonths" INTEGER,
    "warrantyEndDate" TIMESTAMP(3),
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_orderCode_key" ON "ServiceOrder"("orderCode");

-- CreateIndex
CREATE INDEX "ServiceOrder_customerId_idx" ON "ServiceOrder"("customerId");

-- CreateIndex
CREATE INDEX "ServiceOrder_userId_idx" ON "ServiceOrder"("userId");

-- CreateIndex
CREATE INDEX "ServiceOrder_customerPhone_idx" ON "ServiceOrder"("customerPhone");

-- CreateIndex
CREATE INDEX "ServiceOrder_service_idx" ON "ServiceOrder"("service");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_idx" ON "ServiceOrder"("status");

-- CreateIndex
CREATE INDEX "ServiceOrder_source_idx" ON "ServiceOrder"("source");

-- CreateIndex
CREATE INDEX "ServiceOrder_orderDate_idx" ON "ServiceOrder"("orderDate");

-- CreateIndex
CREATE INDEX "ServiceOrder_createdAt_idx" ON "ServiceOrder"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_deletedAt_idx" ON "ServiceOrder"("deletedAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_customerId_orderDate_idx" ON "ServiceOrder"("customerId", "orderDate");

-- CreateIndex
CREATE INDEX "ServiceOrder_customerVisible_userId_idx" ON "ServiceOrder"("customerVisible", "userId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
