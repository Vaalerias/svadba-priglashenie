import { project } from "./project.js";
import { store } from "./data/store.js";
import { familyCodeFromSearch, hasFamilyCode } from "./family-link.js";
import { configuredResponseEndpoint, sendResponseToGoogleSheet } from "./google-sheets-response.js";
import {
  ATTENDING,
  buildFamilyResponsePayload,
  DECLINED,
  MAX_GUESTS,
  validateFamilyResponse,
} from "./family-response.js";
import {
  escapeHtml,
  formatDate,
  onRouteChange,
  qs,
  qsa,
  renderLogin,
  renderShell,
  route,
  setNotice,
  statusLabel,
} from "./ui.js";
import { renderStyleguide } from "./styleguide.js";

const nav = (active) => [
  { href: "#/", label: "Главная", active: active === "/" },
  { href: "#/story", label: "Программа", active: active === "/story" },
  { href: "#/workspace", label: "Ответы", active: active === "/workspace" },
];

function renderParticipantFields(count, participants = []) {
  return Array.from({ length: count }, (_, index) => {
    const person = participants[index] || {};
    return `
      <fieldset class="participant-row" data-participant>
        <legend>Участник ${index + 1}</legend>
        <label>
          Имя
          <input name="participant_first_name_${index}" maxlength="80" value="${escapeHtml(person.first_name || "")}" required>
        </label>
        <label>
          Фамилия
          <input name="participant_last_name_${index}" maxlength="80" value="${escapeHtml(person.last_name || "")}" required>
        </label>
      </fieldset>
    `;
  }).join("");
}

function collectParticipants(form) {
  return qsa("[data-participant]", form).map((row) => ({
    first_name: qs('input[name^="participant_first_name_"]', row).value.trim(),
    last_name: qs('input[name^="participant_last_name_"]', row).value.trim(),
  }));
}

function participantSummary(payload) {
  if (payload.attendance === DECLINED) return "Участников: 0";
  if (Array.isArray(payload.participants) && payload.participants.length) {
    const names = payload.participants
      .map((person) => `${person.first_name || ""} ${person.last_name || ""}`.trim())
      .filter(Boolean)
      .join(", ");
    return `Участников: ${payload.guest_count || payload.participants.length}. ${names}`;
  }
  return payload.details || payload.problem || "";
}

function responderName(payload) {
  if (payload.first_name || payload.last_name) {
    return `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
  }
  return payload.name || "Без имени";
}

function attendanceLabel(payload) {
  if (payload.attendance === DECLINED) return "Не придём";
  if (payload.attendance === ATTENDING) return "Да, придём";
  return payload.contact || "Участие не указано";
}

async function renderHome() {
  const familyCode = familyCodeFromSearch(location.search);
  const responseEndpoint = configuredResponseEndpoint();
  renderShell({
    title: `${project.name} — ${project.title}`,
    nav: [...nav("/"), { href: "#/styleguide", label: "Стиль", active: false }],
    content: `
      <section class="hero">
        <div class="container hero-grid">
          <div>
            <p class="eyebrow">${escapeHtml(project.eyebrow)}</p>
            <h1>${escapeHtml(project.title)}</h1>
            <p class="lead">${escapeHtml(project.lead)}</p>
            <div class="actions">
              <a class="button" href="#request">${escapeHtml(project.cta)}</a>
              <a class="button button--secondary" href="#/story">${escapeHtml(project.secondaryCta)}</a>
            </div>
          </div>
          <aside class="panel">
            <span class="badge">Дорогим гостям</span>
            <h2 style="margin-top:18px;font-size:32px">Анна и Михаил</h2>
            <p>${escapeHtml(project.audience)}</p>
            <p class="muted small">Имена, дата, место и программа — демонстрационные.</p>
          </aside>
        </div>
      </section>

      <section class="section section--soft">
        <div class="container grid grid-3">
          ${project.benefits.map((item) => `
            <article class="card">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.text)}</p>
            </article>
          `).join("")}
        </div>
      </section>

      <section id="request" class="section">
        <div class="container grid grid-2">
          <div>
            <p class="eyebrow">Ответ на приглашение</p>
            <h2>${escapeHtml(project.form.title)}</h2>
            <p class="lead">${escapeHtml(project.form.note)}</p>
          </div>
          <form id="lead-form" class="panel stack" novalidate>
            <label>
              Имя
              <input name="first_name" autocomplete="given-name" maxlength="80" required>
              <span class="help">Для демонстрации используйте вымышленное имя.</span>
            </label>
            <label>
              Фамилия
              <input name="last_name" autocomplete="family-name" maxlength="80" required>
              <span class="help">Для демонстрации используйте вымышленную фамилию.</span>
            </label>
            <fieldset class="choice-group stack">
              <legend>Придёт ли кто-то из вашей семьи?</legend>
              <label class="option">
                <input name="attendance" type="radio" value="${ATTENDING}" required>
                <span>Да, придём</span>
              </label>
              <label class="option">
                <input name="attendance" type="radio" value="${DECLINED}" required>
                <span>Нет, не придём</span>
              </label>
            </fieldset>
            <div id="attendance-details" class="stack" hidden>
              <label>
                Сколько человек придёт, включая вас и детей
                <input name="guest_count" type="number" inputmode="numeric" min="1" max="${MAX_GUESTS}" value="1">
                <span class="help">Каждый взрослый и ребёнок считается отдельным участником.</span>
              </label>
              <div id="participant-list" class="participant-list"></div>
            </div>
            <p id="form-error" class="field-error" hidden></p>
            <p id="form-status" class="form-status" hidden role="status"></p>
            <button class="button" type="submit">${escapeHtml(project.cta)}</button>
          </form>
        </div>
      </section>
    `,
  });

  const leadForm = qs("#lead-form");
  if (!familyCode) {
    leadForm.innerHTML = `
      <h3>Нужна личная ссылка</h3>
      <p>Попросите невесту прислать приглашение для вашей семьи.</p>
    `;
    return;
  }
  const attendanceDetails = qs("#attendance-details");
  const guestCountInput = qs('input[name="guest_count"]', leadForm);
  const participantList = qs("#participant-list");
  const formStatus = qs("#form-status");
  const submitButton = qs('button[type="submit"]', leadForm);
  let currentResponse = store.mode === "local"
    ? (await store.list("family_response")).find((record) => hasFamilyCode(record, familyCode)) || null
    : null;

  const syncParticipantFields = (preferred = null) => {
    const count = Math.min(MAX_GUESTS, Math.max(1, Number.parseInt(guestCountInput.value, 10) || 1));
    guestCountInput.value = String(count);
    const participants = preferred || collectParticipants(leadForm);
    participantList.innerHTML = renderParticipantFields(count, participants);
  };

  const showAttendanceFields = (attendance, participants = null) => {
    attendanceDetails.hidden = attendance !== ATTENDING;
    if (attendance === ATTENDING) syncParticipantFields(participants);
  };

  if (currentResponse) {
    const payload = currentResponse.payload;
    qs('input[name="first_name"]', leadForm).value = payload.first_name || "";
    qs('input[name="last_name"]', leadForm).value = payload.last_name || "";
    const attendanceInput = qs(`input[name="attendance"][value="${payload.attendance}"]`, leadForm);
    if (attendanceInput) attendanceInput.checked = true;
    guestCountInput.value = String(payload.guest_count || 1);
    showAttendanceFields(payload.attendance, payload.participants || []);
    submitButton.textContent = project.form.updateCta;
    formStatus.textContent = project.form.restoredLocal;
    formStatus.hidden = false;
  }

  leadForm.addEventListener("change", (event) => {
    if (event.target.name === "attendance") {
      showAttendanceFields(event.target.value);
      formStatus.hidden = true;
    }
  });

  guestCountInput.addEventListener("input", () => syncParticipantFields());

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const firstName = String(data.get("first_name") || "").trim();
    const lastName = String(data.get("last_name") || "").trim();
    const attendance = String(data.get("attendance") || "");
    const guestCount = attendance === ATTENDING
      ? Number.parseInt(String(data.get("guest_count") || ""), 10)
      : 0;
    const participants = attendance === ATTENDING ? collectParticipants(form) : [];
    const response = { firstName, lastName, attendance, guestCount, participants };
    const error = qs("#form-error");
    const validationError = validateFamilyResponse(response);
    if (validationError) {
      error.textContent = validationError;
      error.hidden = false;
      return;
    }

    error.hidden = true;
    formStatus.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = currentResponse ? "Обновляю…" : "Сохраняю…";

    try {
      const payload = buildFamilyResponsePayload({ ...response, familyCode });
      if (responseEndpoint) await sendResponseToGoogleSheet(responseEndpoint, payload);
      if (store.mode === "local" && currentResponse) {
        currentResponse = await store.update(currentResponse.id, { payload, status: "new" });
      } else {
        const recordType = store.mode === "local" ? "family_response" : "lead";
        const createdResponse = await store.create(recordType, payload, "new");
        if (store.mode === "local") currentResponse = createdResponse;
      }
      const message = store.mode === "local"
        ? project.form.successLocal
        : project.form.successRemote;
      formStatus.textContent = message;
      formStatus.hidden = false;
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : "Не удалось сохранить ответ";
      error.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = currentResponse ? project.form.updateCta : project.cta;
    }
  });
}

function renderStory() {
  renderShell({
    title: `Программа — ${project.name}`,
    nav: [...nav("/story"), { href: "#/styleguide", label: "Стиль", active: false }],
    content: `
      <article class="story">
        <section class="story-scene">
          <p class="eyebrow">Программа свадьбы · демонстрационный пример</p>
          <h1>${escapeHtml(project.title)}</h1>
          <p class="lead">Вот как мы хотим провести этот день вместе с вами.</p>
        </section>
        ${project.story.map((scene) => `
          <section class="story-scene">
            <span class="story-number">${escapeHtml(scene.label)}</span>
            <h2>${escapeHtml(scene.title)}</h2>
            <p class="lead">${escapeHtml(scene.text)}</p>
            <div class="story-visual" aria-label="${escapeHtml(scene.visual)}">${escapeHtml(scene.visual)}</div>
          </section>
        `).join("")}
        <section class="story-scene">
          <h2>Будем рады вас видеть</h2>
          <p class="lead">Вернитесь на главную и сообщите, придёте ли вы. Это демонстрационная форма: ответ сохранится только в вашем браузере.</p>
          <div class="actions"><a class="button" href="#/">Ответить на приглашение</a></div>
        </section>
      </article>
    `,
  });
}

async function workspaceContent() {
  const session = await store.session();
  if (store.mode === "supabase" && !session) return renderLogin();

  const [familyResponses, legacyRecords] = await Promise.all([
    store.mode === "local" ? store.list("family_response") : Promise.resolve([]),
    store.list("lead"),
  ]);
  const records = [...familyResponses, ...legacyRecords]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return `
    <section class="section">
      <div class="container">
        <div class="split">
          <div>
            <p class="eyebrow">Рабочий экран</p>
            <h1 style="font-size:clamp(38px,6vw,64px)">Ответы гостей</h1>
            <p class="lead">${store.mode === "local"
              ? "Локальные записи видны только в этом браузере."
              : `Вход: ${escapeHtml(session?.user?.email || "владелец")}`}</p>
          </div>
          <div class="inline">
            ${store.mode === "local" ? '<button id="seed-leads" class="button button--secondary">Вернуть демо-данные</button>' : ""}
            ${store.mode === "supabase" ? '<button id="logout" class="button button--secondary">Выйти</button>' : ""}
          </div>
        </div>

        <div class="record-list" style="margin-top:30px">
          ${records.length ? records.map((record) => `
            <article class="record" data-id="${record.id}">
              <div class="split">
                <div>
                  <span class="badge">${escapeHtml(statusLabel(record.status))}</span>
                  <h3 style="margin-top:12px">${escapeHtml(responderName(record.payload))}</h3>
                  <p><strong>${escapeHtml(attendanceLabel(record.payload))}</strong></p>
                  <p>${escapeHtml(participantSummary(record.payload))}</p>
                  <p class="record-meta">${formatDate(record.created_at)}</p>
                </div>
                <div class="stack" style="min-width:180px">
                  <label>
                    Статус
                    <select class="status-select">
                      ${["new", "contacted", "done"].map((status) => `
                        <option value="${status}" ${record.status === status ? "selected" : ""}>${statusLabel(status)}</option>
                      `).join("")}
                    </select>
                  </label>
                  <button class="archive button button--danger button--small">В архив</button>
                </div>
              </div>
            </article>
          `).join("") : `
            <div class="empty">
              <h3>Ответов пока нет</h3>
              <p>Откройте главную и отправьте демонстрационный ответ на приглашение.</p>
              <a class="button" href="#/">Открыть форму</a>
            </div>
          `}
        </div>
      </div>
    </section>
  `;
}

async function renderWorkspace() {
  renderShell({
    title: `Ответы гостей — ${project.name}`,
    nav: [...nav("/workspace"), { href: "#/styleguide", label: "Стиль", active: false }],
    content: '<section class="section"><div class="container"><p>Загружаю записи…</p></div></section>',
  });

  qs("#main").innerHTML = await workspaceContent();

  const loginForm = qs("#login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const error = qs("#login-error");
      try {
        await store.signIn(String(data.get("email")), String(data.get("password")));
        await renderWorkspace();
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : "Не удалось войти";
        error.hidden = false;
      }
    });
    return;
  }

  qs("#seed-leads")?.addEventListener("click", async () => {
    await store.reset("lead", [
      { status: "new", payload: { name: "Ольга (демо)", contact: "Да, придём", problem: "2 человека: Ольга и Иван. Вымышленные гости." } },
      { status: "contacted", payload: { name: "Сергей (демо)", contact: "Не смогу прийти", problem: "Не смогу прийти. Вымышленный ответ для примера." } },
    ]);
    await renderWorkspace();
  });

  qs("#logout")?.addEventListener("click", async () => {
    await store.signOut();
    await renderWorkspace();
  });

  for (const node of qsa(".record")) {
    const id = node.dataset.id;
    qs(".status-select", node).addEventListener("change", async (event) => {
      try {
        await store.update(id, { status: event.currentTarget.value });
        setNotice("Статус сохранён");
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : "Не удалось сохранить", "error");
      }
    });
    qs(".archive", node).addEventListener("click", async () => {
      try {
        await store.archive(id);
        await renderWorkspace();
        setNotice("Ответ отправлен в архив");
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : "Не удалось архивировать", "error");
      }
    });
  }
}

async function render() {
  const current = route();
  if (current === "/workspace") return renderWorkspace();
  if (current === "/story") return renderStory();
  if (current === "/styleguide") return renderStyleguide();
  return renderHome();
}

onRouteChange(() => {
  render().catch((error) => {
    console.error(error);
    setNotice(error.message || "Ошибка приложения", "error");
  });
});

