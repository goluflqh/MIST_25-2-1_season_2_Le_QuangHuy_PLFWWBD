import assert from "node:assert/strict";
import test from "node:test";
import {
  isMinhHongImportConfirmationEnabled,
  isMinhHongImportScopeEnabled,
  minhHongImportConfirmationDisabledMessage,
  minhHongImportScopeDisabledMessage,
} from "../../lib/minhhong-import/import-policy";

test("keeps partner previews available while gating production confirmation", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;
  const originalConfirmationEnabled = env.MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED;

  try {
    assert.equal(isMinhHongImportScopeEnabled("service-orders"), true);
    assert.equal(isMinhHongImportScopeEnabled("partners"), true);
    assert.equal(isMinhHongImportScopeEnabled("all"), false);

    env.NODE_ENV = "development";
    delete env.MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED;
    assert.equal(isMinhHongImportConfirmationEnabled("partners"), true);

    env.NODE_ENV = "production";
    assert.equal(isMinhHongImportConfirmationEnabled("service-orders"), true);
    assert.equal(isMinhHongImportConfirmationEnabled("partners"), false);
    assert.equal(isMinhHongImportConfirmationEnabled("all"), false);
    assert.match(minhHongImportConfirmationDisabledMessage("partners"), /chờ duyệt/i);

    env.MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED = "true";
    assert.equal(isMinhHongImportConfirmationEnabled("partners"), true);
    assert.match(minhHongImportScopeDisabledMessage("all"), /phạm vi cập nhật riêng/i);
  } finally {
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    if (originalConfirmationEnabled === undefined) delete env.MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED;
    else env.MINHHONG_PARTNER_IMPORT_CONFIRM_ENABLED = originalConfirmationEnabled;
  }
});
