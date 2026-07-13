import assert from "node:assert/strict";
import test from "node:test";
import {
  createMinhHongSourceSheetFetchGuard,
  MinhHongSourceSheetFetchError,
} from "../../lib/minhhong-import/source-fetch-guard";
import {
  getMinhHongManualRequestMaxBytes,
  MINHHONG_MANUAL_WORKBOOK_MAX_BYTES,
  MINHHONG_MULTIPART_FORM_OVERHEAD_BYTES,
  MinhHongRequestBodyTooLargeError,
  readMinhHongRequestBody,
  readBoundedInteger,
} from "../../lib/minhhong-import/workbook-limits";

test("uses only integer import-limit configuration values inside the safe range", () => {
  assert.equal(readBoundedInteger("10", 5, 1, 50), 10);
  assert.equal(readBoundedInteger("0", 5, 1, 50), 5);
  assert.equal(readBoundedInteger("51", 5, 1, 50), 5);
  assert.equal(readBoundedInteger("10.5", 5, 1, 50), 5);
  assert.equal(readBoundedInteger("not-a-number", 5, 1, 50), 5);
});

test("allows only bounded multipart framing overhead while keeping raw uploads exact", () => {
  assert.equal(
    getMinhHongManualRequestMaxBytes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    MINHHONG_MANUAL_WORKBOOK_MAX_BYTES
  );
  assert.equal(
    getMinhHongManualRequestMaxBytes("multipart/form-data; boundary=workbook"),
    MINHHONG_MANUAL_WORKBOOK_MAX_BYTES + MINHHONG_MULTIPART_FORM_OVERHEAD_BYTES
  );
});

test("streams a chunked workbook request without requiring Content-Length", async () => {
  const request = new Request("http://localhost/upload", {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    }),
    duplex: "half",
    method: "POST",
  } as RequestInit & { duplex: "half" });

  assert.deepEqual([...await readMinhHongRequestBody(request, 4)], [1, 2, 3, 4]);
});

test("stops a chunked workbook request before it can exceed memory limits", async () => {
  let cancelled = false;
  const request = new Request("http://localhost/upload", {
    body: new ReadableStream({
      cancel() {
        cancelled = true;
      },
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
      },
    }),
    duplex: "half",
    method: "POST",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(
    () => readMinhHongRequestBody(request, 5),
    (error) => error instanceof MinhHongRequestBodyTooLargeError
  );
  assert.equal(cancelled, true);
});

test("bounds the combined Google Sheet workbook export bytes", async () => {
  const fetchImpl: typeof fetch = async () => new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-length": "1" },
    status: 200,
  });
  const guardedFetch = createMinhHongSourceSheetFetchGuard(fetchImpl, {
    maxTotalBytes: 5,
    maxTotalMegabytes: 5,
    timeoutMs: 1_000,
  });

  const first = await guardedFetch("https://docs.google.com/spreadsheets/d/legacy/export?format=xlsx");
  assert.deepEqual([...new Uint8Array(await first.arrayBuffer())], [1, 2, 3]);

  await assert.rejects(
    () => guardedFetch("https://docs.google.com/spreadsheets/d/manual/export?format=xlsx"),
    (error) => error instanceof MinhHongSourceSheetFetchError
      && error.status === 413
      && /Sheet gốc không bị thay đổi/.test(error.message)
  );
});

test("times out a stalled Google Sheet request with a no-write message", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  const guardedFetch = createMinhHongSourceSheetFetchGuard(fetchImpl, {
    maxTotalBytes: 10,
    maxTotalMegabytes: 1,
    timeoutMs: 10,
  });

  await assert.rejects(
    () => guardedFetch("https://docs.google.com/spreadsheets/d/legacy/export?format=xlsx"),
    (error) => error instanceof MinhHongSourceSheetFetchError
      && error.status === 504
      && /Chưa có dữ liệu nào được áp dụng/.test(error.message)
  );
});

test("keeps the timeout active while the Google Sheet response body is streaming", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      init?.signal?.addEventListener(
        "abort",
        () => controller.error(new Error("stream aborted")),
        { once: true }
      );
    },
  }), { status: 200 });
  const guardedFetch = createMinhHongSourceSheetFetchGuard(fetchImpl, {
    maxTotalBytes: 10,
    maxTotalMegabytes: 1,
    timeoutMs: 10,
  });

  await assert.rejects(
    () => guardedFetch("https://docs.google.com/spreadsheets/d/legacy/export?format=xlsx"),
    (error) => error instanceof MinhHongSourceSheetFetchError
      && error.status === 504
      && /Chưa có dữ liệu nào được áp dụng/.test(error.message)
  );
});
