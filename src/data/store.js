const STORAGE_KEY = "airc_records_v1";
const SESSION_KEY = "airc_supabase_session_v1";

function runtime() {
  return window.AIRC_RUNTIME || { dataMode: "local" };
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeRecord(record) {
  return {
    id: record.id,
    workspace_id: record.workspace_id,
    record_type: record.record_type,
    payload: record.payload || {},
    status: record.status || "new",
    created_at: record.created_at,
    updated_at: record.updated_at,
    archived_at: record.archived_at || null,
  };
}

const localStore = {
  mode: "local",
  async session() {
    return { user: { email: "local@demo" }, local: true };
  },
  async signIn() {
    return this.session();
  },
  async signOut() {},
  async list(recordType) {
    return readLocal()
      .filter((record) => record.record_type === recordType && !record.archived_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  async create(recordType, payload, status = "new") {
    const now = new Date().toISOString();
    const record = normalizeRecord({
      id: crypto.randomUUID(),
      workspace_id: runtime().workspaceId || "airc-demo",
      record_type: recordType,
      payload,
      status,
      created_at: now,
      updated_at: now,
      archived_at: null,
    });
    const records = readLocal();
    records.push(record);
    writeLocal(records);
    return record;
  },
  async update(id, patch) {
    const records = readLocal();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) throw new Error("Запись не найдена");
    records[index] = normalizeRecord({
      ...records[index],
      ...patch,
      payload: patch.payload ? { ...records[index].payload, ...patch.payload } : records[index].payload,
      updated_at: new Date().toISOString(),
    });
    writeLocal(records);
    return records[index];
  },
  async archive(id) {
    return this.update(id, { archived_at: new Date().toISOString() });
  },
  async reset(recordType, seeds = []) {
    const records = readLocal().filter((record) => record.record_type !== recordType);
    const now = Date.now();
    const seeded = seeds.map((seed, index) => normalizeRecord({
      id: crypto.randomUUID(),
      workspace_id: runtime().workspaceId || "airc-demo",
      record_type: recordType,
      payload: seed.payload,
      status: seed.status || "new",
      created_at: new Date(now - index * 3600_000).toISOString(),
      updated_at: new Date(now - index * 3600_000).toISOString(),
      archived_at: null,
    }));
    writeLocal([...records, ...seeded]);
    return seeded;
  },
};

function supabaseConfig() {
  const cfg = runtime().supabase || {};
  if (!cfg.url || !cfg.publishableKey) {
    throw new Error("Заполни supabase.url и supabase.publishableKey в runtime-config.js");
  }
  return {
    url: cfg.url.replace(/\/$/, ""),
    key: cfg.publishableKey,
    workspaceId: runtime().workspaceId || "airc-demo",
  };
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function authRequest(path, body) {
  const cfg = supabaseConfig();
  const response = await fetch(`${cfg.url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: cfg.key,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || "Не удалось войти");
  return data;
}

async function ensureSession() {
  let session = loadSession();
  if (!session) return null;
  const expiresAt = Number(session.expires_at || 0) * 1000;
  if (expiresAt > Date.now() + 60_000) return session;
  if (!session.refresh_token) return null;
  try {
    session = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
    saveSession(session);
    return session;
  } catch {
    saveSession(null);
    return null;
  }
}

async function rest(path, { method = "GET", body, requireAuth = true, prefer } = {}) {
  const cfg = supabaseConfig();
  const session = requireAuth ? await ensureSession() : null;
  if (requireAuth && !session?.access_token) throw new Error("Сначала войди во внутренний экран");
  const headers = {
    "content-type": "application/json",
    apikey: cfg.key,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(prefer ? { Prefer: prefer } : {}),
  };
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || `Ошибка базы: ${response.status}`);
  }
  return data;
}

const supabaseStore = {
  mode: "supabase",
  async session() {
    const session = await ensureSession();
    return session ? { user: session.user, local: false } : null;
  },
  async signIn(email, password) {
    const session = await authRequest("token?grant_type=password", { email, password });
    saveSession(session);
    return { user: session.user, local: false };
  },
  async signOut() {
    const session = await ensureSession();
    if (session?.access_token) {
      const cfg = supabaseConfig();
      await fetch(`${cfg.url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: cfg.key, Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
    }
    saveSession(null);
  },
  async list(recordType) {
    const cfg = supabaseConfig();
    const query = new URLSearchParams({
      select: "*",
      workspace_id: `eq.${cfg.workspaceId}`,
      record_type: `eq.${recordType}`,
      archived_at: "is.null",
      order: "created_at.desc",
    });
    return (await rest(`airc_records?${query}`)).map(normalizeRecord);
  },
  async create(recordType, payload, status = "new") {
    const cfg = supabaseConfig();
    const publicSubmission = ["lead", "quiz_result"].includes(recordType);
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      workspace_id: cfg.workspaceId,
      record_type: recordType,
      payload,
      status,
    };

    if (publicSubmission) {
      // Анонимная вставка не получает SELECT-доступ. return=minimal позволяет
      // сохранить запись без ослабления RLS и без чтения только что созданной строки.
      await rest("airc_records", {
        method: "POST",
        requireAuth: false,
        prefer: "return=minimal",
        body: [row],
      });
      return normalizeRecord({ ...row, created_at: now, updated_at: now, archived_at: null });
    }

    const rows = await rest("airc_records", {
      method: "POST",
      prefer: "return=representation",
      body: [row],
    });
    return normalizeRecord(rows[0]);
  },
  async update(id, patch) {
    const body = {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.payload !== undefined ? { payload: patch.payload } : {}),
      ...(patch.archived_at !== undefined ? { archived_at: patch.archived_at } : {}),
      updated_at: new Date().toISOString(),
    };
    const rows = await rest(`airc_records?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body,
    });
    return normalizeRecord(rows[0]);
  },
  async archive(id) {
    return this.update(id, { archived_at: new Date().toISOString() });
  },
  async reset() {
    throw new Error("Сброс демо-данных доступен только в локальном режиме");
  },
};

export const store = runtime().dataMode === "supabase" ? supabaseStore : localStore;
