import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import {
  normalizePartnerEntryPayload,
  normalizePartnerPayload,
  partnerInclude,
  PartnerLedgerValidationError,
  serializePartner,
} from "@/lib/partner-ledger";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const partners = await prisma.partner.findMany({
      where: { deletedAt: null },
      include: partnerInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      partners: partners.map(serializePartner),
    });
  } catch (error) {
    console.error("Partner ledger GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được sổ đối tác lúc này." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse("Dữ liệu sổ đối tác chưa đúng định dạng.");

    if (body.kind === "partner") {
      const normalized = normalizePartnerPayload(body);
      const partner = await prisma.partner.create({
        data: normalized,
        include: partnerInclude,
      });

      await recordAuditLog({
        action: "PARTNER_CREATE",
        actor: admin,
        entity: "Partner",
        entityId: partner.id,
        newData: toAuditJson(partner),
        request,
      });

      return NextResponse.json({ success: true, partner: serializePartner(partner) }, { status: 201 });
    }

    const normalized = normalizePartnerEntryPayload(body);
    if (!normalized.partnerId) {
      return NextResponse.json({ success: false, message: "Thiếu đối tác cần ghi giao dịch." }, { status: 400 });
    }

    const partner = await prisma.$transaction(async (tx) => {
      const existingPartner = await tx.partner.findUnique({
        where: { id: normalized.partnerId },
        select: { deletedAt: true, id: true },
      });

      if (!existingPartner || existingPartner.deletedAt) {
        throw new PartnerLedgerValidationError("Không tìm thấy đối tác cần ghi giao dịch.");
      }

      await tx.partnerLedgerEntry.create({ data: normalized });

      return tx.partner.findUniqueOrThrow({
        where: { id: normalized.partnerId },
        include: partnerInclude,
      });
    });

    await recordAuditLog({
      action: "PARTNER_LEDGER_ENTRY_CREATE",
      actor: admin,
      entity: "PartnerLedgerEntry",
      entityId: null,
      newData: toAuditJson(normalized),
      request,
    });

    return NextResponse.json({ success: true, partner: serializePartner(partner) }, { status: 201 });
  } catch (error) {
    console.error("Partner ledger POST error:", error);

    if (error instanceof PartnerLedgerValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Mã đối tác đã tồn tại. Hãy dùng mã khác." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Không ghi được sổ đối tác lúc này." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse("Dữ liệu cập nhật sổ đối tác chưa đúng định dạng.");

    if (body.kind === "partner") {
      const id = sanitizeText(String(body.id || ""));
      if (!id) return NextResponse.json({ success: false, message: "Thiếu đối tác cần cập nhật." }, { status: 400 });

      const previous = await prisma.partner.findUnique({ where: { id }, include: partnerInclude });
      if (!previous || previous.deletedAt) {
        return NextResponse.json({ success: false, message: "Không tìm thấy đối tác." }, { status: 404 });
      }

      const normalized = normalizePartnerPayload(body);
      const partner = await prisma.partner.update({
        where: { id },
        data: normalized,
        include: partnerInclude,
      });

      await recordAuditLog({
        action: "PARTNER_UPDATE",
        actor: admin,
        entity: "Partner",
        entityId: partner.id,
        oldData: toAuditJson(previous),
        newData: toAuditJson(partner),
        request,
      });

      return NextResponse.json({ success: true, partner: serializePartner(partner) });
    }

    const id = sanitizeText(String(body.id || ""));
    if (!id) return NextResponse.json({ success: false, message: "Thiếu giao dịch cần cập nhật." }, { status: 400 });

    const previous = await prisma.partnerLedgerEntry.findUnique({ where: { id } });
    if (!previous || previous.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy giao dịch." }, { status: 404 });
    }

    const normalized = normalizePartnerEntryPayload({
      amount: previous.amount,
      category: previous.category || "",
      countsInDebt: previous.countsInDebt,
      description: previous.description,
      discountPercent: previous.discountPercent ?? "",
      entryDate: previous.entryDate,
      entryType: previous.entryType,
      notes: previous.notes || "",
      partnerId: previous.partnerId,
      paymentMethod: previous.paymentMethod || "",
      quantity: previous.quantity || "",
      reference: previous.reference || "",
      receivedGoods: previous.receivedGoods ?? "",
      sourceCode: previous.sourceCode || "",
      sourceName: previous.sourceName || "",
      sourceRow: previous.sourceRow || "",
      unit: previous.unit || "",
      unitPrice: previous.unitPrice || "",
      ...body,
    });
    const partner = await prisma.$transaction(async (tx) => {
      const entry = await tx.partnerLedgerEntry.update({
        where: { id },
        data: normalized,
      });

      return tx.partner.findUniqueOrThrow({
        where: { id: entry.partnerId },
        include: partnerInclude,
      });
    });

    await recordAuditLog({
      action: "PARTNER_LEDGER_ENTRY_UPDATE",
      actor: admin,
      entity: "PartnerLedgerEntry",
      entityId: id,
      oldData: toAuditJson(previous),
      newData: toAuditJson(normalized),
      request,
    });

    return NextResponse.json({ success: true, partner: serializePartner(partner) });
  } catch (error) {
    console.error("Partner ledger PATCH error:", error);

    if (error instanceof PartnerLedgerValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { success: false, message: "Không cập nhật được sổ đối tác lúc này." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse("Dữ liệu xoá giao dịch chưa đúng định dạng.");

    const id = sanitizeText(String(body.id || ""));
    if (!id) return NextResponse.json({ success: false, message: "Thiếu giao dịch cần xoá." }, { status: 400 });

    const previous = await prisma.partnerLedgerEntry.findUnique({ where: { id } });
    if (!previous || previous.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy giao dịch." }, { status: 404 });
    }

    const partner = await prisma.$transaction(async (tx) => {
      await tx.partnerLedgerEntry.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return tx.partner.findUniqueOrThrow({
        where: { id: previous.partnerId },
        include: partnerInclude,
      });
    });

    await recordAuditLog({
      action: "PARTNER_LEDGER_ENTRY_DELETE",
      actor: admin,
      entity: "PartnerLedgerEntry",
      entityId: id,
      oldData: toAuditJson(previous),
      request,
    });

    return NextResponse.json({ success: true, partner: serializePartner(partner) });
  } catch (error) {
    console.error("Partner ledger DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được giao dịch lúc này." },
      { status: 500 }
    );
  }
}
