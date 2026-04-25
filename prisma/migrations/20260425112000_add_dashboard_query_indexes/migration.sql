CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");

CREATE INDEX "ContactRequest_source_createdAt_idx" ON "ContactRequest"("source", "createdAt");

CREATE INDEX "Review_approved_createdAt_idx" ON "Review"("approved", "createdAt");

CREATE INDEX "PricingItem_category_sortOrder_idx" ON "PricingItem"("category", "sortOrder");

CREATE INDEX "PricingItem_active_category_sortOrder_idx" ON "PricingItem"("active", "category", "sortOrder");

CREATE INDEX "Coupon_createdAt_idx" ON "Coupon"("createdAt");

CREATE INDEX "Coupon_active_createdAt_idx" ON "Coupon"("active", "createdAt");

CREATE INDEX "Warranty_createdAt_idx" ON "Warranty"("createdAt");

CREATE INDEX "Warranty_endDate_idx" ON "Warranty"("endDate");

CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
