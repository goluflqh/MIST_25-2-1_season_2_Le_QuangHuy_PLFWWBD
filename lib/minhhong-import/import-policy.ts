import type { MinhHongImportScope } from "./import-scope";

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isMinhHongImportScopeEnabled(scope: MinhHongImportScope) {
  return scope === "service-orders" || scope === "partners";
}

export function isMinhHongImportConfirmationEnabled(scope: MinhHongImportScope) {
  if (scope === "service-orders") return true;
  if (scope !== "partners") return false;

  return process.env.NODE_ENV !== "production"
    || isEnabled(process.env.MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED);
}

export function minhHongImportScopeDisabledMessage(scope: MinhHongImportScope) {
  if (scope === "all") {
    return "Hãy chọn một phạm vi cập nhật riêng: đơn bán khách hoặc công nợ đối tác.";
  }

  return "Phạm vi import này chưa được hỗ trợ.";
}

export function minhHongImportConfirmationDisabledMessage(scope: MinhHongImportScope) {
  if (scope === "partners") {
    return "Dữ liệu công nợ đối tác đang chờ duyệt. Bạn vẫn có thể kiểm tra số liệu, nhưng chưa thể xác nhận cập nhật trên môi trường thật.";
  }

  return "Chưa thể xác nhận cập nhật với phạm vi dữ liệu này.";
}
