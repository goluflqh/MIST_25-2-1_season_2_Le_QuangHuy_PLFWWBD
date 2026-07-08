"use client";

import { useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface ImportResponse {
  success: boolean;
  message?: string;
  mode?: "preview" | "confirm";
  sourceSheetDateRepairs?: number;
  reconciliation?: {
    ok: boolean;
    blockingIssues: string[];
    warnings: string[];
  };
  counts?: {
    partners: number;
    partnerEntries: number;
    customerOrders: number;
    skippedRows: number;
    errors: number;
  };
  totals?: {
    longPayable: number;
    longHistoricalPaid: number;
    customerOrderTotal: number;
    customerOrderPaid: number;
  };
  importResult?: {
    partnersUpserted: number;
    partnerEntriesUpserted: number;
    serviceOrdersUpserted: number;
    sourceSheetDateRepairs?: number;
    changes: ImportChanges;
  };
  changes?: ImportChanges;
}

interface ChangeCounts {
  created: number;
  updated: number;
  unchanged: number;
}

interface ImportChanges {
  partners: ChangeCounts;
  partnerEntries: ChangeCounts;
  serviceOrders: ChangeCounts;
  conflicts: string[];
  records: {
    partnerEntries: ChangeRecord[];
    serviceOrders: ChangeRecord[];
  };
}

interface ChangeRecord {
  action: "created" | "updated";
  key: string;
  label: string;
}

interface MinhHongWorkbookImportPanelProps {
  compact?: boolean;
  onImported?: () => void;
  scope?: "all" | "service-orders" | "partners";
}

type ImportSource = "workbook" | "raw-sheet";
type ImportScope = NonNullable<MinhHongWorkbookImportPanelProps["scope"]>;

function formatMoney(value: number | undefined) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function totalChanges(changes: ImportChanges | undefined, scope: ImportScope = "all") {
  if (!changes) return { created: 0, updated: 0, unchanged: 0 };
  if (scope === "service-orders") return { ...changes.serviceOrders };
  if (scope === "partners") {
    return {
      created: changes.partners.created + changes.partnerEntries.created,
      updated: changes.partners.updated + changes.partnerEntries.updated,
      unchanged: changes.partners.unchanged + changes.partnerEntries.unchanged,
    };
  }
  return {
    created: changes.partnerEntries.created + changes.serviceOrders.created,
    updated: changes.partnerEntries.updated + changes.serviceOrders.updated,
    unchanged: changes.partnerEntries.unchanged + changes.serviceOrders.unchanged,
  };
}

function previewToast(sourceLabel: string, changes: ImportChanges | undefined, scope: ImportScope = "all") {
  if (!changes) return sourceLabel + " đã khớp đối soát.";
  const totals = totalChanges(changes, scope);
  if (!totals.created && !totals.updated) {
    return sourceLabel + " đã khớp: không có bản ghi mới hoặc đã sửa.";
  }
  return sourceLabel
    + " đã kiểm tra: "
    + totals.created + " mới, "
    + totals.updated + " đã sửa, "
    + totals.unchanged + " không đổi.";
}

function isServiceOrderMessage(message: string) {
  return /Đơn khách|Đơn hàng đã bán|Mã đơn|Dòng Excel|đơn khách|khách/i.test(message);
}

function filterMessagesForScope(messages: string[] | undefined, scope: ImportScope) {
  const items = messages || [];
  if (scope === "service-orders") return items.filter(isServiceOrderMessage);
  if (scope === "partners") return items.filter((message) => !isServiceOrderMessage(message));
  return items;
}

function serviceOrderSummaryLine(preview: ImportResponse) {
  const orders = preview.changes?.serviceOrders;
  if (!orders) return `${preview.counts?.customerOrders || 0} dòng đơn khách trong Sheet.`;
  return `${orders.created} đơn mới · ${orders.updated} đơn đã sửa · ${orders.unchanged} đơn không đổi.`;
}

function partnerSummaryLine(preview: ImportResponse) {
  const entries = preview.changes?.partnerEntries;
  if (!entries) return `${preview.counts?.partnerEntries || 0} dòng giao dịch đối tác trong Sheet.`;
  return `${entries.created} giao dịch mới · ${entries.updated} giao dịch đã sửa · ${entries.unchanged} giao dịch không đổi.`;
}

export default function MinhHongWorkbookImportPanel({ compact = false, onImported, scope = "all" }: MinhHongWorkbookImportPanelProps) {
  const { showToast } = useNotify();
  const serviceOrderScope = scope === "service-orders";
  const partnerScope = scope === "partners";
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<ImportSource | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);

  const submitImport = async (mode: "preview" | "confirm", source: ImportSource) => {
    if (source === "workbook" && !file) {
      showToast("Chọn workbook .xlsx trước khi import.", "error");
      return;
    }

    if (mode === "preview") setIsPreviewing(true);
    if (mode === "confirm") setIsConfirming(true);
    setPreviewSource(source);
    if (mode === "preview") setIsPreviewExpanded(true);

    try {
      const params = new URLSearchParams({ mode, source });
      if (scope !== "all") params.set("scope", scope);
      const response = await fetch(
        "/api/admin/minhhong-import?" + params.toString(),
        source === "workbook" && file
          ? {
              method: "POST",
              headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "X-Workbook-Name": encodeURIComponent(file.name),
              },
              body: await file.arrayBuffer(),
            }
          : { method: "POST" }
      );
      const data = await response.json() as ImportResponse;
      const sourceLabel = source === "raw-sheet" ? "Sheet gốc" : "Workbook";

      if (!response.ok || !data.success) {
        showToast(data.message || sourceLabel + " chưa xử lý được.", "error");
        setPreview(data);
        setPreviewSource(source);
        return;
      }

      setPreview(data);
      setPreviewSource(source);
      if (mode === "confirm") {
        showToast("Đã áp dụng dữ liệu Minh Hồng vào web.", "success");
        onImported?.();
      } else if (data.reconciliation?.ok) {
        showToast(previewToast(sourceLabel, data.changes, scope), "success");
      } else {
        showToast(sourceLabel + " còn điểm cần đối soát trước khi import.", "error");
      }
    } catch {
      showToast("Kết nối bị gián đoạn khi xử lý dữ liệu Minh Hồng.", "error");
    } finally {
      setIsPreviewing(false);
      setIsConfirming(false);
    }
  };

  const canConfirmPreview = Boolean(
    preview?.reconciliation?.ok
    && preview.changes
    && preview.changes.conflicts.length === 0
    && !isConfirming
    && !isPreviewing
  );
  const canConfirmWorkbook = Boolean(canConfirmPreview && previewSource === "workbook" && file);
  const canConfirmRawSheet = Boolean(canConfirmPreview && previewSource === "raw-sheet");
  const changedRecords = preview?.changes
    ? [
        ...(partnerScope ? [] : preview.changes.records.serviceOrders.map((record) => ({ ...record, group: "Đơn khách" }))),
        ...(serviceOrderScope ? [] : preview.changes.records.partnerEntries.map((record) => ({ ...record, group: "Giao dịch đối tác" }))),
      ]
    : [];
  const changeTotals = totalChanges(preview?.changes, scope);
  const visibleBlockingIssues = filterMessagesForScope(preview?.reconciliation?.blockingIssues, scope);
  const visibleWarnings = filterMessagesForScope(preview?.reconciliation?.warnings, scope);
  const importResultCreated = preview?.importResult
    ? serviceOrderScope
      ? preview.importResult.changes.serviceOrders.created
      : partnerScope
        ? preview.importResult.changes.partners.created + preview.importResult.changes.partnerEntries.created
        : preview.importResult.changes.partnerEntries.created + preview.importResult.changes.serviceOrders.created
    : 0;
  const importResultUpdated = preview?.importResult
    ? serviceOrderScope
      ? preview.importResult.changes.serviceOrders.updated
      : partnerScope
        ? preview.importResult.changes.partners.updated + preview.importResult.changes.partnerEntries.updated
        : preview.importResult.changes.partnerEntries.updated + preview.importResult.changes.serviceOrders.updated
    : 0;
  const pendingSourceSheetDateRepairs = previewSource === "raw-sheet" && !partnerScope ? preview?.sourceSheetDateRepairs || 0 : 0;
  const rawSheetConfirmLabel = partnerScope
    ? "Áp dụng đối tác vào web"
    : pendingSourceSheetDateRepairs
      ? "Áp dụng vào web & sửa ngày Sheet"
      : "Áp dụng vào web & chuẩn hóa ngày Sheet";
  const changedRecordNoun = serviceOrderScope ? "đơn" : partnerScope ? "giao dịch/đối tác" : "bản ghi";

  return (
    <section data-testid="minhhong-workbook-import-panel" className="rounded-lg border border-red-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:flex-1">
          <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Dữ liệu Minh Hồng</p>
          <h3 className="font-heading text-lg font-extrabold text-slate-900 text-pretty">
            {serviceOrderScope ? "Nhập Sheet đơn bán → web" : partnerScope ? "Nhập Sheet đối tác → web" : "Nhập Excel/Sheet → web"}
          </h3>
            <p className="mt-1 font-body text-sm text-slate-600 sm:hidden">
              {serviceOrderScope
                ? "Chỉ kiểm tra và cập nhật đơn khách/đơn bán."
                : partnerScope
                  ? "Chỉ kiểm tra và cập nhật công nợ đối tác."
                  : "Sheet/Excel → web. Luôn kiểm tra preview trước khi áp dụng."}
            </p>
            <p className="mt-1 hidden font-body text-sm text-slate-600 sm:block">
              {serviceOrderScope
                ? "Đọc Sheet gốc hoặc workbook chuẩn .xlsx, chỉ xem và áp dụng phần Đơn khách/đơn bán vào trang Đơn dịch vụ. Phần đối tác sẽ xử lý riêng ở trang Đối tác."
                : partnerScope
                  ? "Đọc Sheet gốc hoặc workbook chuẩn .xlsx, chỉ xem và áp dụng phần Đối tác/Nhập hàng/Thanh toán/Trả hàng vào trang Đối tác. Phần Đơn khách không bị ghi từ màn này."
                  : "Đọc Sheet gốc hoặc workbook chuẩn .xlsx, xem preview/đối soát, rồi mới áp dụng vào web. Nút “Xuất web → Sheet” là chiều ngược lại."}
            </p>
          </div>
          <button
            type="button"
            data-testid="minhhong-workbook-mobile-toggle"
            onClick={() => setIsMobileOpen((current) => !current)}
            aria-expanded={isMobileOpen}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-body font-bold text-slate-700 transition-colors hover:bg-slate-50 sm:hidden"
          >
            {isMobileOpen ? "Ẩn khu nhập ▲" : "Mở khu nhập ▼"}
          </button>
        </div>
        <div className={`${isMobileOpen ? "flex" : "hidden"} flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-end`}>
          <input
            data-testid="minhhong-workbook-file"
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setPreviewSource(null);
            }}
            className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 font-body text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-body file:text-xs file:font-bold file:text-slate-700"
          />
          <p className="-mt-1 font-body text-xs text-slate-500 sm:hidden">
            File Excel chuẩn là đường dự phòng; chọn file .xlsx thì 2 nút Excel mới dùng được.
          </p>
          <button
            type="button"
            data-testid="minhhong-source-sheet-preview"
            onClick={() => submitImport("preview", "raw-sheet")}
            disabled={isPreviewing || isConfirming}
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-body text-sm font-bold text-white disabled:bg-slate-300"
          >
            {isPreviewing && previewSource === "raw-sheet" ? "Đang đọc Sheet…" : "Kiểm tra từ Sheet gốc"}
          </button>
          <button
            type="button"
            data-testid="minhhong-source-sheet-confirm"
            onClick={() => submitImport("confirm", "raw-sheet")}
            disabled={!canConfirmRawSheet}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2 font-body text-sm font-bold text-white disabled:bg-slate-300"
          >
            {isConfirming && previewSource === "raw-sheet" ? "Đang áp dụng…" : rawSheetConfirmLabel}
          </button>
          <button
            type="button"
            data-testid="minhhong-workbook-preview"
            onClick={() => submitImport("preview", "workbook")}
            disabled={!file || isPreviewing || isConfirming}
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-body text-sm font-bold text-white disabled:bg-slate-300"
          >
            {isPreviewing && previewSource === "workbook" ? "Đang kiểm tra…" : "Kiểm tra file Excel đã chọn"}
          </button>
          <button
            type="button"
            data-testid="minhhong-workbook-confirm"
            onClick={() => submitImport("confirm", "workbook")}
            disabled={!canConfirmWorkbook}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2 font-body text-sm font-bold text-white disabled:bg-slate-300"
          >
            {isConfirming && previewSource === "workbook" ? "Đang cập nhật…" : "Áp dụng file Excel vào web"}
          </button>
          <p className="font-body text-xs text-slate-500 sm:basis-full sm:text-right">
            Hai nút Excel chỉ là đường dự phòng khi Google Sheet lỗi hoặc bạn muốn kiểm tra file .xlsx đã tải về; bình thường dùng Sheet gốc.
          </p>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3" data-testid="minhhong-workbook-preview-report">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body text-sm font-extrabold text-slate-900">
                {serviceOrderScope ? "Báo cáo kiểm tra đơn bán khách" : partnerScope ? "Báo cáo kiểm tra công nợ đối tác" : "Báo cáo kiểm tra dữ liệu Minh Hồng"}
              </p>
              <p className="mt-1 font-body text-sm text-slate-600 tabular-nums">
                {serviceOrderScope
                  ? serviceOrderSummaryLine(preview)
                  : partnerScope
                    ? partnerSummaryLine(preview)
                  : `${changeTotals.created} mới · ${changeTotals.updated} đã sửa · ${changeTotals.unchanged} không đổi.`}
              </p>
            </div>
            <button
              type="button"
              data-testid="minhhong-workbook-preview-toggle"
              aria-expanded={isPreviewExpanded}
              onClick={() => setIsPreviewExpanded((current) => !current)}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
            >
              {isPreviewExpanded ? "Thu gọn kết quả ▲" : "Mở kết quả ▼"}
            </button>
          </div>

          {isPreviewExpanded ? (
            <div className="mt-3" data-testid="minhhong-workbook-preview-body">
              <div className={`grid gap-3 ${compact ? "md:grid-cols-2" : "lg:grid-cols-4"}`} data-testid="minhhong-workbook-preview-summary">
                {serviceOrderScope ? (
                  <>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="font-body text-xs font-bold text-green-700">Đơn khách trong Sheet</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-green-700">{preview.counts?.customerOrders || 0} dòng</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-body text-xs font-bold text-slate-600">Đơn mới</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-slate-900">{preview.changes?.serviceOrders.created || 0} đơn</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="font-body text-xs font-bold text-amber-700">Đơn đã sửa</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-amber-700">{preview.changes?.serviceOrders.updated || 0} đơn</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="font-body text-xs font-bold text-red-700">Trạng thái</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-red-700">{preview.reconciliation?.ok ? "Sẵn sàng áp dụng" : "Cần kiểm tra"}</p>
                    </div>
                  </>
                ) : partnerScope ? (
                  <>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="font-body text-xs font-bold text-red-700">Long cần trả</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-red-700">{formatMoney(preview.totals?.longPayable)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-body text-xs font-bold text-slate-600">Ledger đối tác</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-slate-900">{preview.counts?.partnerEntries || 0} dòng</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="font-body text-xs font-bold text-green-700">Đối tác</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-green-700">{preview.counts?.partners || 0} đối tác</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="font-body text-xs font-bold text-amber-700">Đối soát</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-amber-700">{preview.reconciliation?.ok ? "Sẵn sàng áp dụng" : "Cần kiểm tra"}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="font-body text-xs font-bold text-red-700">Long cần trả</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-red-700">{formatMoney(preview.totals?.longPayable)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-body text-xs font-bold text-slate-600">Ledger đối tác</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-slate-900">{preview.counts?.partnerEntries || 0} dòng</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="font-body text-xs font-bold text-green-700">Đơn khách</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-green-700">{preview.counts?.customerOrders || 0} dòng</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="font-body text-xs font-bold text-amber-700">Đối soát</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-amber-700">{preview.reconciliation?.ok ? "Đã khớp" : "Cần kiểm tra"}</p>
                    </div>
                  </>
                )}
              </div>

              {preview?.changes ? (
                <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3" data-testid="minhhong-workbook-change-headline">
                  <p className="font-body text-sm font-extrabold text-green-800">
                    {serviceOrderScope ? "Báo cáo đơn bán khách" : partnerScope ? "Báo cáo công nợ đối tác" : "Tóm tắt thay đổi"}
                  </p>
                  <p className="mt-1 font-body text-sm text-green-900 tabular-nums">
                    {serviceOrderScope ? (
                      <>
                        {preview.changes.serviceOrders.created} đơn mới
                        {" · "}{preview.changes.serviceOrders.updated} đơn đã sửa
                        {" · "}{changeTotals.unchanged} đơn không đổi
                      </>
                    ) : partnerScope ? (
                      <>
                        {preview.changes.partners.created} đối tác mới
                        {" · "}{preview.changes.partners.updated} đối tác đã sửa
                        {" · "}{preview.changes.partnerEntries.created} giao dịch mới
                        {" · "}{preview.changes.partnerEntries.updated} giao dịch đã sửa
                        {" · "}{changeTotals.unchanged} bản ghi không đổi
                      </>
                    ) : (
                      <>
                        {preview.changes.serviceOrders.created} đơn mới
                        {" · "}{preview.changes.serviceOrders.updated} đơn đã sửa
                        {" · "}{preview.changes.partnerEntries.created} giao dịch đối tác mới
                        {" · "}{preview.changes.partnerEntries.updated} giao dịch đối tác đã sửa
                        {" · "}{changeTotals.unchanged} bản ghi không đổi
                      </>
                    )}
                  </p>
                </div>
              ) : null}

              {preview?.changes ? (
                <div className={`mt-3 grid gap-2 ${serviceOrderScope ? "md:grid-cols-1" : "md:grid-cols-2"}`} data-testid="minhhong-workbook-change-summary">
                  {!serviceOrderScope ? (
                    <div className="rounded-lg border border-slate-100 bg-white p-3">
                      <p className="font-body text-sm font-bold text-slate-900">Giao dịch đối tác</p>
                      <p className="mt-1 font-body text-sm text-slate-600 tabular-nums">
                        Mới <strong className="text-green-700">{preview.changes.partnerEntries.created}</strong>
                        {" · "}Cập nhật <strong className="text-amber-700">{preview.changes.partnerEntries.updated}</strong>
                        {" · "}Không đổi <strong>{preview.changes.partnerEntries.unchanged}</strong>
                      </p>
                    </div>
                  ) : null}
                  {partnerScope ? (
                    <div className="rounded-lg border border-slate-100 bg-white p-3">
                      <p className="font-body text-sm font-bold text-slate-900">Đối tác</p>
                      <p className="mt-1 font-body text-sm text-slate-600 tabular-nums">
                        Mới <strong className="text-green-700">{preview.changes.partners.created}</strong>
                        {" · "}Đã sửa <strong className="text-amber-700">{preview.changes.partners.updated}</strong>
                        {" · "}Không đổi <strong>{preview.changes.partners.unchanged}</strong>
                      </p>
                    </div>
                  ) : null}
                  {!partnerScope ? (
                    <div className="rounded-lg border border-slate-100 bg-white p-3">
                      <p className="font-body text-sm font-bold text-slate-900">Đơn khách</p>
                      <p className="mt-1 font-body text-sm text-slate-600 tabular-nums">
                        Mới <strong className="text-green-700">{preview.changes.serviceOrders.created}</strong>
                        {" · "}Đã sửa <strong className="text-amber-700">{preview.changes.serviceOrders.updated}</strong>
                        {" · "}Không đổi <strong>{preview.changes.serviceOrders.unchanged}</strong>
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {previewSource === "raw-sheet" && !partnerScope ? (
                <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3" data-testid="minhhong-source-sheet-date-repair-note">
                  <p className="font-body text-sm font-semibold text-sky-900">
                    Nút kiểm tra chỉ xem trước, chưa ghi lên Sheet gốc. Khi bấm “{rawSheetConfirmLabel}”, hệ thống sẽ cập nhật dữ liệu web xong rồi
                    {pendingSourceSheetDateRepairs
                      ? ` sửa ${pendingSourceSheetDateRepairs} ô ngày nhập sai trên Sheet gốc`
                      : " chuẩn hóa định dạng cột ngày trên Sheet gốc"}
                    {" "}về dạng dd/mm/yyyy.
                  </p>
                </div>
              ) : null}

              {changedRecords.length > 0 ? (
                <details className="mt-3 border-t border-slate-100 pt-3" data-testid="minhhong-workbook-change-details">
                  <summary className="cursor-pointer font-body text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100">
                    Xem {changedRecords.length} {changedRecordNoun} mới hoặc đã sửa
                  </summary>
                  <div className="mt-3 divide-y divide-slate-100">
                    {changedRecords.slice(0, 20).map((record) => (
                      <div key={`${record.group}-${record.key}`} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-body text-xs font-bold text-slate-500">{record.group}</p>
                          <p className="break-words font-body text-sm font-semibold text-slate-900">
                            {record.group === "Đơn khách" ? `${record.key} · ` : ""}{record.label}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 font-body text-xs font-bold ${record.action === "created" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {record.action === "created" ? "Mới" : "Đã sửa"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {changedRecords.length > 20 ? (
                    <p className="mt-2 font-body text-xs text-slate-500">Còn {changedRecords.length - 20} {changedRecordNoun}; tổng số vẫn hiển thị ở phía trên.</p>
                  ) : null}
                </details>
              ) : null}

              {preview?.changes?.conflicts.length ? (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3" data-testid="minhhong-workbook-conflicts">
                  {preview.changes.conflicts.map((conflict) => (
                    <p key={conflict} className="font-body text-sm font-semibold text-red-700">{conflict}</p>
                  ))}
                </div>
              ) : null}

              {visibleBlockingIssues.length ? (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3" data-testid="minhhong-workbook-blocking-issues">
                  {visibleBlockingIssues.map((issue) => (
                    <p key={issue} className="font-body text-sm font-semibold text-red-700">{issue}</p>
                  ))}
                </div>
              ) : null}

              {visibleWarnings.length ? (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3" data-testid="minhhong-workbook-warnings">
                  <p className="mb-1 font-body text-xs font-bold uppercase tracking-wider text-amber-700">
                    {serviceOrderScope ? "Dòng cần kiểm tra trong Sheet" : partnerScope ? "Cảnh báo công nợ đối tác" : "Cảnh báo dữ liệu nguồn"}
                  </p>
                  {visibleWarnings.slice(0, 8).map((warning) => (
                    <p key={warning} className="font-body text-sm font-semibold text-amber-800">{warning}</p>
                  ))}
                  {visibleWarnings.length > 8 ? (
                    <p className="mt-1 font-body text-xs text-amber-700">Còn {visibleWarnings.length - 8} cảnh báo khác.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  data-testid="minhhong-workbook-preview-collapse-bottom"
                  onClick={() => setIsPreviewExpanded(false)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                >
                  Thu gọn kết quả ↑
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {preview?.importResult ? (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 font-body text-sm font-bold text-green-700" data-testid="minhhong-workbook-import-result">
          Hoàn tất: {importResultCreated} {changedRecordNoun} mới, {importResultUpdated} {changedRecordNoun} đã sửa; dữ liệu không đổi đã được bỏ qua.
          {preview.importResult.sourceSheetDateRepairs ? ` Đã chuẩn hóa ${preview.importResult.sourceSheetDateRepairs} ô ngày trên Sheet gốc.` : ""}
        </p>
      ) : null}
    </section>
  );
}
