const MEBIBYTE = 1024 * 1024;

export function readBoundedInteger(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!rawValue || !/^\d+$/.test(rawValue)) return fallback;
  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

export const MINHHONG_MANUAL_WORKBOOK_MAX_MB = readBoundedInteger(
  process.env.NEXT_PUBLIC_MINHHONG_WORKBOOK_UPLOAD_MAX_MB,
  10,
  1,
  50
);

export const MINHHONG_SOURCE_WORKBOOK_MAX_MB = readBoundedInteger(
  process.env.MINHHONG_SOURCE_SHEET_WORKBOOK_MAX_MB,
  25,
  5,
  100
);

export const MINHHONG_SOURCE_FETCH_TIMEOUT_MS = readBoundedInteger(
  process.env.MINHHONG_SOURCE_SHEET_FETCH_TIMEOUT_MS,
  30_000,
  5_000,
  120_000
);

export const MINHHONG_MANUAL_WORKBOOK_MAX_BYTES = MINHHONG_MANUAL_WORKBOOK_MAX_MB * MEBIBYTE;
export const MINHHONG_SOURCE_WORKBOOK_MAX_BYTES = MINHHONG_SOURCE_WORKBOOK_MAX_MB * MEBIBYTE;
export const MINHHONG_MULTIPART_FORM_OVERHEAD_BYTES = 256 * 1024;

export class MinhHongRequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the configured workbook limit.");
    this.name = "MinhHongRequestBodyTooLargeError";
  }
}

export function getMinhHongManualRequestMaxBytes(contentType: string | null) {
  return contentType?.toLowerCase().includes("multipart/form-data")
    ? MINHHONG_MANUAL_WORKBOOK_MAX_BYTES + MINHHONG_MULTIPART_FORM_OVERHEAD_BYTES
    : MINHHONG_MANUAL_WORKBOOK_MAX_BYTES;
}

export async function readMinhHongRequestBody(request: Request, maxBytes: number) {
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new MinhHongRequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, totalBytes);
}
