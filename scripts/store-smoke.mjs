import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const storeUrl = pathToFileURL(resolve(root, "src/data/store.js")).href;
const responseUrl = pathToFileURL(resolve(root, "src/family-response.js")).href;
const familyLinkUrl = pathToFileURL(resolve(root, "src/family-link.js")).href;
const googleSheetsResponseUrl = pathToFileURL(resolve(root, "src/google-sheets-response.js")).href;

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

async function testLocal() {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = { AIRC_RUNTIME: { dataMode: "local", workspaceId: "airc-demo" } };
  const { store } = await import(`${storeUrl}?test=local-${Date.now()}`);

  const created = await store.create("lead", { name: "Тест" });
  assert.ok(created.id);
  assert.equal((await store.list("lead")).length, 1);

  const updated = await store.update(created.id, {
    status: "done",
    payload: { contact: "@airc" },
  });
  assert.equal(updated.status, "done");
  assert.equal(updated.payload.name, "Тест");
  assert.equal(updated.payload.contact, "@airc");

  await store.archive(created.id);
  assert.equal((await store.list("lead")).length, 0);

  await store.reset("lead", [{ payload: { name: "Seed" }, status: "new" }]);
  assert.equal((await store.list("lead")).length, 1);

  const {
    ATTENDING,
    buildFamilyResponsePayload,
    DECLINED,
    validateFamilyResponse,
  } = await import(responseUrl);
  const attendingResponse = {
    firstName: "Ольга",
    lastName: "Тестова",
    attendance: ATTENDING,
    guestCount: 2,
    participants: [
      { first_name: "Ольга", last_name: "Тестова" },
      { first_name: "Иван", last_name: "Тестов" },
    ],
    familyCode: "wedding-family-demo-a",
  };
  assert.equal(validateFamilyResponse(attendingResponse), "");
  assert.match(validateFamilyResponse({
    ...attendingResponse,
    guestCount: 2,
    participants: attendingResponse.participants.slice(0, 1),
  }), /Количество участников/);

  const familyRecord = await store.create(
    "family_response",
    buildFamilyResponsePayload(attendingResponse),
  );
  assert.equal((await store.list("family_response")).length, 1);
  assert.equal(familyRecord.payload.guest_count, 2);
  assert.equal(familyRecord.payload.family_code, "wedding-family-demo-a");

  const { familyCodeFromSearch, hasFamilyCode } = await import(familyLinkUrl);
  assert.equal(familyCodeFromSearch("?family=wedding-family-demo-a"), "wedding-family-demo-a");
  assert.equal(familyCodeFromSearch("?family=short"), null);
  assert.equal(hasFamilyCode(familyRecord, "wedding-family-demo-a"), true);
  assert.equal(hasFamilyCode(familyRecord, "wedding-family-demo-b"), false);

  const { configuredResponseEndpoint } = await import(googleSheetsResponseUrl);
  globalThis.window.AIRC_RUNTIME.weddingResponse = { endpoint: "" };
  assert.equal(configuredResponseEndpoint(), null);
  globalThis.window.AIRC_RUNTIME.weddingResponse.endpoint = "https://script.google.com/macros/s/test/exec";
  assert.equal(configuredResponseEndpoint(), "https://script.google.com/macros/s/test/exec");

  const declinedPayload = buildFamilyResponsePayload({
    firstName: "Ольга",
    lastName: "Тестова",
    attendance: DECLINED,
    guestCount: 0,
    participants: [],
    familyCode: "wedding-family-demo-a",
  });
  await store.update(familyRecord.id, { payload: declinedPayload });
  const familyRecords = await store.list("family_response");
  assert.equal(familyRecords.length, 1);
  assert.equal(familyRecords[0].payload.guest_count, 0);
  assert.deepEqual(familyRecords[0].payload.participants, []);
}

async function testPublicSupabaseInsert() {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = {
    AIRC_RUNTIME: {
      dataMode: "supabase",
      workspaceId: "airc-demo",
      supabase: {
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      },
    },
  };

  let captured;
  globalThis.fetch = async (url, options = {}) => {
    captured = { url: String(url), options };
    return new Response("", { status: 201 });
  };

  const { store } = await import(`${storeUrl}?test=supabase-${Date.now()}`);
  const created = await store.create("lead", {
    name: "Тест",
    contact: "@test",
    problem: "Тестовая проблема",
  });

  assert.ok(created.id);
  assert.equal(created.workspace_id, "airc-demo");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.Prefer, "return=minimal");
  assert.equal(captured.options.headers.apikey, "sb_publishable_test");
  assert.equal(captured.options.headers.Authorization, undefined);
}

async function testAuthenticatedSupabaseRequest() {
  globalThis.localStorage = new MemoryStorage();
  globalThis.localStorage.setItem("airc_supabase_session_v1", JSON.stringify({
    access_token: "owner-access-jwt",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { email: "owner@example.com" },
  }));
  globalThis.window = {
    AIRC_RUNTIME: {
      dataMode: "supabase",
      workspaceId: "airc-demo",
      supabase: {
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      },
    },
  };

  let captured;
  globalThis.fetch = async (url, options = {}) => {
    captured = { url: String(url), options };
    return new Response("[]", { status: 200 });
  };

  const { store } = await import(`${storeUrl}?test=authenticated-${Date.now()}`);
  await store.list("workspace_item");

  assert.equal(captured.options.headers.apikey, "sb_publishable_test");
  assert.equal(captured.options.headers.Authorization, "Bearer owner-access-jwt");
}

await testLocal();
await testPublicSupabaseInsert();
await testAuthenticatedSupabaseRequest();
console.log("Store smoke-test пройден");
