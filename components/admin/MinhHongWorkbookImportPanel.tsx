"use client";

import { useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface ImportResponse {
  success: boolean;
  message?: string;
  mode?: "preview" | "confirm";
  previewFingerprint?: string;
  confirmation?: {
    enabled: boolean;
    message?: string;
  };
  sourceSetup?: {
    required: boolean;
    fingerprint?: string;
  };
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
    partners?: ChangeRecord[];
    partnerEntries: ChangeRecord[];
    serviceOrders: ChangeRecord[];
  };
}

interface FieldChange {
  after: string;
  before: string;
  field: string;
  label: string;
}

interface ChangeRecord {
  action: "created" | "updated";
  changes?: FieldChange[];
  key: string;
  label: string;
}

interface MinhHongWorkbookImportPanelProps {
  compact?: boolean;
  onImported?: () => void;
  scope?: "all" | "service-orders" | "partners";
}

type ImportScope = NonNullable<MinhHongWorkbookImportPanelProps["scope"]>;
type ChangedRecord = ChangeRecord & { group: string };

const CHANGE_RECORDS_PER_PAGE = 10;

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

function sourceSheetLinkHref(scope: ImportScope, target?: string) {
  const params = new URLSearchParams({ scope });
  if (target) params.set("target", target);
  return "/api/admin/minhhong-source-sheet-link?" + params.toString();
}

function friendlyImportMessage(message: string | undefined, fallback: string) {
  if (!message) return fallback;
  if (/source_id|fingerprint|dấu vân tay|32 ký tự|HEX/i.test(message)) {
    if (/chưa có source_id/i.test(message)) {
      return "Google Sheet chưa sẵn sàng. Hãy mở Google Sheet, kiểm tra quyền chỉnh sửa rồi thử lại.";
    }
    if (/trùng/i.test(message)) return "Google Sheet có dòng bị trùng. Hãy kiểm tra các dòng được báo trước khi cập nhật.";
    if (/thay đổi/i.test(message)) return "Google Sheet vừa được chỉnh sửa. Hãy kiểm tra lại dữ liệu.";
    return "Có liên kết dữ liệu không khớp giữa Google Sheet và web. Hãy kiểm tra lại trước khi cập nhật.";
  }
  return message;
}

function groupMessages(messages: string[]) {
  const counts = new Map<string, number>();
  for (const message of messages) {
    counts.set(message, (counts.get(message) || 0) + 1);
  }
  return [...counts.entries()].map(([message, count]) => ({ message, count }));
}

export default function MinhHongWorkbookImportPanel({ compact = false, onImported, scope = "all" }: MinhHongWorkbookImportPanelProps) {
  const { showToast } = useNotify();
  const serviceOrderScope = scope === "service-orders";
  const partnerScope = scope === "partners";
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPreparingSourceSheet, setIsPreparingSourceSheet] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const [changedRecordsPage, setChangedRecordsPage] = useState(1);

  const submitImport = async (
    mode: "preview" | "confirm",
    options?: { preservePreview?: boolean; previewSuccessMessage?: string }
  ): Promise<void> => {
    if (mode === "confirm" && !preview?.previewFingerprint) {
      showToast("Hãy kiểm tra dữ liệu lại trước khi cập nhật.", "error");
      return;
    }
    if (mode === "confirm" && preview?.confirmation?.enabled === false) {
      showToast(preview.confirmation.message || "Chưa thể xác nhận cập nhật lúc này.", "error");
      return;
    }
    if (mode === "preview") {
      setIsPreviewing(true);
      if (!options?.preservePreview) setPreview(null);
      setChangedRecordsPage(1);
    }
    if (mode === "confirm") setIsConfirming(true);
    if (mode === "preview") setIsPreviewExpanded(true);

    try {
      const params = new URLSearchParams({ mode, source: "raw-sheet" });
      if (scope !== "all") params.set("scope", scope);
      if (mode === "confirm" && preview?.previewFingerprint) {
        params.set("previewFingerprint", preview.previewFingerprint);
      }
      const response = await fetch("/api/admin/minhhong-import?" + params.toString(), { method: "POST" });
      const data = await response.json() as ImportResponse;
      const sourceLabel = "Google Sheet";

      if (!response.ok || !data.success) {
        if (mode === "confirm" && data.sourceSetup?.required) {
          await submitImport("preview");
          return;
        }
        const message = friendlyImportMessage(data.message, sourceLabel + " chưa xử lý được.");
        showToast(message, "error");
        if (mode === "preview") {
          setPreview(null);
        }
        return;
      }

      setPreview(data);
      if (
        mode === "preview"
        && data.sourceSetup?.required
        && data.confirmation?.enabled !== false
      ) {
        const setupFingerprint = data.sourceSetup.fingerprint;
        if (!setupFingerprint) {
          showToast("Dữ liệu kiểm tra chưa đủ để chuẩn bị Google Sheet. Hãy thử lại.", "error");
          return;
        }
        if (await prepareSourceSheet(setupFingerprint)) {
          await submitImport("preview", {
            preservePreview: true,
            previewSuccessMessage: "Google Sheet đã sẵn sàng. Dữ liệu đã được kiểm tra lại.",
          });
        }
        return;
      }
      if (mode === "confirm") {
        showToast("Đã áp dụng dữ liệu Minh Hồng vào web.", "success");
        onImported?.();
      } else if (data.confirmation?.enabled === false) {
        showToast("Dữ liệu đã được kiểm tra và đang chờ duyệt số liệu.", "success");
      } else if (data.sourceSetup?.required) {
        showToast("Dữ liệu đã được kiểm tra. Hãy hoàn tất thiết lập lần đầu.", "success");
      } else if (data.reconciliation?.ok) {
        showToast(options?.previewSuccessMessage || previewToast(sourceLabel, data.changes, scope), "success");
      } else {
        showToast(sourceLabel + " còn điểm cần đối soát trước khi import.", "error");
      }
    } catch {
      showToast(
        mode === "preview"
          ? "Kết nối bị gián đoạn khi kiểm tra dữ liệu. Hãy thử lại."
          : "Kết nối bị gián đoạn khi cập nhật dữ liệu. Hãy thử lại.",
        "error"
      );
      if (mode === "preview") {
        setPreview(null);
      }
    } finally {
      setIsPreviewing(false);
      setIsConfirming(false);
    }
  };

  const prepareSourceSheet = async (setupFingerprint: string) => {
    setIsPreparingSourceSheet(true);
    try {
      const params = new URLSearchParams({ scope });
      const response = await fetch("/api/admin/minhhong-source-sheet-ids?" + params.toString(), {
        body: JSON.stringify({ setupFingerprint }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json() as ImportResponse;
      if (!response.ok || !data.success) {
        showToast(friendlyImportMessage(data.message, "Chưa hoàn tất được thiết lập Google Sheet."), "error");
        return false;
      }
      return true;
    } catch {
      showToast("Kết nối bị gián đoạn khi thiết lập Google Sheet. Hãy thử lại.", "error");
      return false;
    } finally {
      setIsPreparingSourceSheet(false);
    }
  };

  const changeTotals = totalChanges(preview?.changes, scope);
  const hasPendingChanges = changeTotals.created + changeTotals.updated > 0;
  const canConfirmPreview = Boolean(
    preview?.reconciliation?.ok
    && preview.changes
    && preview.changes.conflicts.length === 0
    && preview.sourceSetup?.required !== true
    && preview.previewFingerprint
    && preview.confirmation?.enabled !== false
    && hasPendingChanges
    && !isConfirming
    && !isPreviewing
  );
  const canConfirmRawSheet = canConfirmPreview;
  const changedRecords: ChangedRecord[] = preview?.changes
    ? [
        ...(serviceOrderScope ? [] : (preview.changes.records.partners || []).map((record) => ({ ...record, group: "Đối tác" }))),
        ...(partnerScope ? [] : preview.changes.records.serviceOrders.map((record) => ({ ...record, group: "Đơn khách" }))),
        ...(serviceOrderScope ? [] : preview.changes.records.partnerEntries.map((record) => ({ ...record, group: "Giao dịch đối tác" }))),
      ]
    : [];
  const identityRelinkedRecords = changedRecords.filter((record) => record.action === "updated" && record.changes?.length === 0);
  const detailRecords = changedRecords.filter((record) => !identityRelinkedRecords.includes(record));
  const changedRecordsPageCount = Math.max(1, Math.ceil(detailRecords.length / CHANGE_RECORDS_PER_PAGE));
  const currentChangedRecordsPage = Math.min(changedRecordsPage, changedRecordsPageCount);
  const pagedChangedRecords = detailRecords.slice(
    (currentChangedRecordsPage - 1) * CHANGE_RECORDS_PER_PAGE,
    currentChangedRecordsPage * CHANGE_RECORDS_PER_PAGE
  );
  const visibleConflicts = groupMessages((preview?.changes?.conflicts || [])
    .map((message) => friendlyImportMessage(message, message)));
  const visibleBlockingIssues = groupMessages(filterMessagesForScope(preview?.reconciliation?.blockingIssues, scope)
    .map((message) => friendlyImportMessage(message, message)));
  const visibleWarnings = groupMessages(filterMessagesForScope(preview?.reconciliation?.warnings, scope)
    .map((message) => friendlyImportMessage(message, message)));
  const previewStatus = visibleConflicts.length > 0
    ? "Có xung đột"
    : preview?.sourceSetup?.required && preview.confirmation?.enabled !== false
      ? "Cần hoàn tất thiết lập"
    : preview?.reconciliation?.ok && preview.confirmation?.enabled !== false
      ? "Sẵn sàng áp dụng"
      : preview?.reconciliation?.ok
        ? "Chờ duyệt số liệu"
        : "Cần kiểm tra";
  const previewStatusTone = visibleConflicts.length > 0 || !preview?.reconciliation?.ok
    ? { card: "bg-red-50", text: "text-red-700" }
    : preview?.sourceSetup?.required || preview?.confirmation?.enabled === false
      ? { card: "bg-amber-50", text: "text-amber-700" }
      : { card: "bg-green-50", text: "text-green-700" };
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
  const rawSheetConfirmLabel = serviceOrderScope
    ? `Cập nhật ${changeTotals.created + changeTotals.updated} đơn lên web`
    : partnerScope
      ? `Cập nhật ${changeTotals.created + changeTotals.updated} mục lên web`
      : `Cập nhật ${changeTotals.created + changeTotals.updated} bản ghi lên web`;
  const rawSheetReadyToConfirm = preview?.mode === "preview"
    && hasPendingChanges
    && !preview.sourceSetup?.required;
  const rawSheetWaitingForApproval = preview?.mode === "preview"
    && preview.confirmation?.enabled === false;
  const rawSheetActionLabel = isConfirming
    ? "Đang cập nhật…"
    : isPreparingSourceSheet
      ? "Đang chuẩn bị Google Sheet…"
    : isPreviewing
      ? "Đang kiểm tra…"
      : preview?.mode === "confirm"
        ? "Đã cập nhật"
        : rawSheetWaitingForApproval
          ? "Chờ duyệt số liệu"
          : rawSheetReadyToConfirm
            ? rawSheetConfirmLabel
            : preview?.mode === "preview" && !hasPendingChanges
              ? "Kiểm tra lại Sheet"
              : "Kiểm tra dữ liệu từ Sheet";
  const changedRecordNoun = serviceOrderScope ? "đơn" : partnerScope ? "giao dịch/đối tác" : "bản ghi";

  return (
    <section data-testid="minhhong-workbook-import-panel" className="rounded-lg border border-red-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:items-start lg:gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <div className="lg:block">
          <div className="min-w-0">
            <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Dữ liệu Minh Hồng</p>
            <h3 className="text-pretty font-heading text-lg font-extrabold text-slate-900">
              {serviceOrderScope ? "Cập nhật đơn bán" : partnerScope ? "Cập nhật công nợ đối tác" : "Cập nhật dữ liệu lên web"}
            </h3>
            <p className="mt-1 font-body text-sm leading-5 text-slate-600">
              {serviceOrderScope
                ? "Kiểm tra thay đổi từ Google Sheet trước khi cập nhật đơn lên web."
                : partnerScope
                  ? "Kiểm tra thay đổi từ Google Sheet trước khi cập nhật công nợ lên web."
                  : "Luôn kiểm tra thay đổi trước khi cập nhật dữ liệu lên web."}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <button
              type="button"
              data-testid="minhhong-source-sheet-preview"
              onClick={() => submitImport(rawSheetReadyToConfirm ? "confirm" : "preview")}
              disabled={isPreviewing || isConfirming || isPreparingSourceSheet || rawSheetWaitingForApproval || (rawSheetReadyToConfirm && !canConfirmRawSheet)}
              className={`min-h-11 rounded-lg px-4 py-2 font-body text-sm font-bold text-white transition-colors disabled:bg-slate-300 ${rawSheetReadyToConfirm ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"}`}
            >
              {rawSheetActionLabel}
            </button>
            <a
              data-testid="minhhong-source-sheet-open"
              href={sourceSheetLinkHref(scope, partnerScope ? "partners-current" : serviceOrderScope ? "service-orders" : undefined)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-md px-2 py-2 font-body text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Mở Sheet
            </a>
          </div>
          <p className="font-body text-xs leading-5 text-slate-500" data-testid="minhhong-source-sheet-preparation-note">
            Kiểm tra chỉ đọc Google Sheet gốc; không sửa thông tin khách, sản phẩm, số tiền, ngày hoặc cấu trúc dữ liệu.
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
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
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
                    <div className={`rounded-lg p-3 ${previewStatusTone.card}`}>
                      <p className={`font-body text-xs font-bold ${previewStatusTone.text}`}>Trạng thái</p>
                      <p className={`mt-1 font-heading text-lg font-extrabold ${previewStatusTone.text}`}>{previewStatus}</p>
                    </div>
                  </>
                ) : partnerScope ? (
                  <>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="font-body text-xs font-bold text-red-700">Long cần trả</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-red-700">{formatMoney(preview.totals?.longPayable)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-body text-xs font-bold text-slate-600">Giao dịch đối tác</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-slate-900">{preview.counts?.partnerEntries || 0} dòng</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="font-body text-xs font-bold text-green-700">Đối tác</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-green-700">{preview.counts?.partners || 0} đối tác</p>
                    </div>
                    <div className={`rounded-lg p-3 ${previewStatusTone.card}`}>
                      <p className={`font-body text-xs font-bold ${previewStatusTone.text}`}>Trạng thái</p>
                      <p className={`mt-1 font-heading text-lg font-extrabold ${previewStatusTone.text}`}>{previewStatus}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="font-body text-xs font-bold text-red-700">Long cần trả</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-red-700">{formatMoney(preview.totals?.longPayable)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-body text-xs font-bold text-slate-600">Giao dịch đối tác</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-slate-900">{preview.counts?.partnerEntries || 0} dòng</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="font-body text-xs font-bold text-green-700">Đơn khách</p>
                      <p className="mt-1 font-heading text-lg font-extrabold text-green-700">{preview.counts?.customerOrders || 0} dòng</p>
                    </div>
                    <div className={`rounded-lg p-3 ${previewStatusTone.card}`}>
                      <p className={`font-body text-xs font-bold ${previewStatusTone.text}`}>Trạng thái</p>
                      <p className={`mt-1 font-heading text-lg font-extrabold ${previewStatusTone.text}`}>{previewStatus}</p>
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

              {preview?.confirmation?.enabled === false ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="minhhong-workbook-confirmation-gate">
                  <p className="font-body text-sm font-bold text-amber-900">Chưa thể xác nhận cập nhật</p>
                  <p className="mt-1 font-body text-sm text-amber-800">
                    {preview.confirmation.message || "Hãy chờ số liệu được duyệt trước khi xác nhận cập nhật."}
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

              {visibleConflicts.length ? (
                <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3" data-testid="minhhong-workbook-conflicts">
                  <p className="font-body text-sm font-extrabold text-red-800">Có xung đột — chưa thể xác nhận cập nhật</p>
                  <div className="mt-2 space-y-1">
                    {visibleConflicts.map((conflict) => (
                      <p key={conflict.message} className="font-body text-sm font-semibold text-red-700">
                        {conflict.message}{conflict.count > 1 ? ` (${conflict.count} dòng)` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {identityRelinkedRecords.length ? (
                <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 font-body text-sm text-sky-900" data-testid="minhhong-workbook-identity-relink-note">
                  Đã nối lại {identityRelinkedRecords.length} {changedRecordNoun} với dữ liệu đã có; không thay đổi thông tin nghiệp vụ.
                </p>
              ) : null}

              {detailRecords.length > 0 ? (
                <details className="mt-3 border-t border-slate-100 pt-3" data-testid="minhhong-workbook-change-details">
                  <summary className="cursor-pointer font-body text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100">
                    Xem {detailRecords.length} {changedRecordNoun} mới hoặc đã sửa
                  </summary>
                  <div className="mt-3 divide-y divide-slate-100">
                    {pagedChangedRecords.map((record) => (
                      <div key={`${record.group}-${record.key}`} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-body text-xs font-bold text-slate-500">{record.group}</p>
                          <p className="break-words font-body text-sm font-semibold text-slate-900">
                            {record.group === "Đơn khách" ? `${record.key} · ` : ""}{record.label}
                          </p>
                          {record.action === "updated" && record.changes?.length ? (
                            <ul className="mt-2 space-y-1 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
                              {record.changes.slice(0, 4).map((change) => (
                                <li key={change.field} className="break-words font-body text-xs text-amber-900">
                                  <strong>{change.label}:</strong> {change.before} → {change.after}
                                </li>
                              ))}
                              {record.changes.length > 4 ? (
                                <li className="font-body text-xs font-semibold text-amber-800">
                                  +{record.changes.length - 4} thay đổi khác
                                </li>
                              ) : null}
                            </ul>
                          ) : null}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 font-body text-xs font-bold ${record.action === "created" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {record.action === "created" ? "Mới" : "Đã sửa"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {changedRecordsPageCount > 1 ? (
                    <div className="mt-3 flex items-center justify-between gap-3" data-testid="minhhong-workbook-change-pagination">
                      <button
                        type="button"
                        data-testid="minhhong-workbook-change-page-previous"
                        disabled={currentChangedRecordsPage === 1}
                        onClick={() => setChangedRecordsPage((page) => Math.max(1, page - 1))}
                        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-body text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        Trước
                      </button>
                      <p className="font-body text-xs font-semibold text-slate-600" aria-live="polite">
                        Trang {currentChangedRecordsPage}/{changedRecordsPageCount}
                      </p>
                      <button
                        type="button"
                        data-testid="minhhong-workbook-change-page-next"
                        disabled={currentChangedRecordsPage === changedRecordsPageCount}
                        onClick={() => setChangedRecordsPage((page) => Math.min(changedRecordsPageCount, page + 1))}
                        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-body text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        Sau
                      </button>
                    </div>
                  ) : null}
                </details>
              ) : null}

              {visibleBlockingIssues.length ? (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3" data-testid="minhhong-workbook-blocking-issues">
                  <p className="mb-1 font-body text-sm font-bold text-red-800">Cần xử lý trước khi xác nhận</p>
                  {visibleBlockingIssues.map((issue) => (
                    <p key={issue.message} className="font-body text-sm font-semibold text-red-700">
                      {issue.message}{issue.count > 1 ? ` (${issue.count} dòng)` : ""}
                    </p>
                  ))}
                </div>
              ) : null}

              {visibleWarnings.length ? (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3" data-testid="minhhong-workbook-warnings">
                  <p className="mb-1 font-body text-xs font-bold uppercase tracking-wider text-amber-700">
                    {serviceOrderScope ? "Dòng cần kiểm tra trong Sheet" : partnerScope ? "Cảnh báo công nợ đối tác" : "Cảnh báo dữ liệu nguồn"}
                  </p>
                  {visibleWarnings.slice(0, 8).map((warning) => (
                    <p key={warning.message} className="font-body text-sm font-semibold text-amber-800">
                      {warning.message}{warning.count > 1 ? ` (${warning.count} dòng)` : ""}
                    </p>
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
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
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
        </p>
      ) : null}
    </section>
  );
}
