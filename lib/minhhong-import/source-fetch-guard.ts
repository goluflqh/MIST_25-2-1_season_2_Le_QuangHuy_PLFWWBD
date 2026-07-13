import {
  MINHHONG_SOURCE_FETCH_TIMEOUT_MS,
  MINHHONG_SOURCE_WORKBOOK_MAX_BYTES,
  MINHHONG_SOURCE_WORKBOOK_MAX_MB,
} from "./workbook-limits";

interface SourceSheetFetchGuardOptions {
  maxTotalBytes?: number;
  maxTotalMegabytes?: number;
  timeoutMs?: number;
}

export class MinhHongSourceSheetFetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MinhHongSourceSheetFetchError";
    this.status = status;
  }
}

function isWorkbookExportRequest(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : String(input);
  return url.includes("docs.google.com/spreadsheets/d/") && url.includes("/export?");
}

function sourceWorkbookTooLarge(maxMegabytes: number) {
  return new MinhHongSourceSheetFetchError(
    `Dữ liệu tải từ Sheet gốc vượt quá giới hạn ${maxMegabytes} MB. Sheet gốc không bị thay đổi; hãy giảm dữ liệu thừa hoặc tăng hạn mức cấu hình rồi thử lại.`,
    413
  );
}

async function readResponseWithinLimit(response: Response, maxBytes: number, maxMegabytes: number) {
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw sourceWorkbookTooLarge(maxMegabytes);
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw sourceWorkbookTooLarge(maxMegabytes);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw sourceWorkbookTooLarge(maxMegabytes);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, totalBytes);
}

async function fetchExportWithinLimit(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
  maxBytes: number,
  maxMegabytes: number
) {
  const controller = new AbortController();
  let timedOut = false;
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    if (!response.ok || !isWorkbookExportRequest(input)) return response;

    const buffer = await readResponseWithinLimit(response, maxBytes, maxMegabytes);
    const headers = new Headers(response.headers);
    headers.set("content-length", String(buffer.byteLength));
    return new Response(buffer, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    if (timedOut) {
      throw new MinhHongSourceSheetFetchError(
        "Google Sheet phản hồi quá lâu. Chưa có dữ liệu nào được áp dụng; vui lòng thử lại.",
        504
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export function createMinhHongSourceSheetFetchGuard(
  fetchImpl: typeof fetch = fetch,
  options: SourceSheetFetchGuardOptions = {}
): typeof fetch {
  const maxTotalBytes = options.maxTotalBytes ?? MINHHONG_SOURCE_WORKBOOK_MAX_BYTES;
  const maxTotalMegabytes = options.maxTotalMegabytes ?? MINHHONG_SOURCE_WORKBOOK_MAX_MB;
  const timeoutMs = options.timeoutMs ?? MINHHONG_SOURCE_FETCH_TIMEOUT_MS;
  let totalExportBytes = 0;

  return async (input, init) => {
    const response = await fetchExportWithinLimit(
      fetchImpl,
      input,
      init,
      timeoutMs,
      Math.max(maxTotalBytes - totalExportBytes, 0),
      maxTotalMegabytes
    );
    if (!response.ok || !isWorkbookExportRequest(input)) return response;

    const contentLength = response.headers.get("content-length");
    if (contentLength && /^\d+$/.test(contentLength)) {
      totalExportBytes += Number(contentLength);
    } else {
      totalExportBytes += (await response.clone().arrayBuffer()).byteLength;
    }
    return response;
  };
}
