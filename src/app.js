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

const invitationNav = () => [
  { href: "#request", label: project.cta, active: false },
];

function invitationIcon(name) {
  const paths = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    pin: '<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
    welcome: '<path d="M4 19h16M6.5 19v-8l5.5-4 5.5 4v8M9 19v-4h6v4"/><path d="M3.5 8.5h17"/>',
    rings: '<circle cx="9.5" cy="13.5" r="3.5"/><circle cx="14.5" cy="13.5" r="3.5"/><path d="m9.5 10-1-2h2l-1 2m5 0-1-2h2l-1 2"/>',
    dinner: '<path d="M7 4v7M4.5 4v4a2.5 2.5 0 0 0 5 0V4M7 11v9M16.5 4v16M16.5 4c2.2 1.2 2.2 5.8 0 7"/>',
  };
  return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.clock}</svg>`;
}

function coupleMonogram(compact = false) {
  return `
    <div class="couple-monogram${compact ? " couple-monogram--compact" : ""}" role="img" aria-label="Инициалы Анны и Михаила">
      <span class="couple-monogram__letters" aria-hidden="true">А<br>М</span>
      <img class="couple-monogram__sprig" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
    </div>
  `;
}

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
  const program = project.benefits.find((item) => Array.isArray(item.schedule));
  const guestInfo = project.benefits.find((item) => !Array.isArray(item.schedule));
  renderShell({
    title: `${project.name} — ${project.title}`,
    nav: invitationNav(),
    content: `
      <section class="invitation-layout invitation-story" aria-label="Свадебное приглашение">
        <article class="invitation-panel invitation-panel--hero">
          <img class="botanical botanical--hero" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
          ${coupleMonogram()}
          <p class="panel-kicker">Вместе с семьями</p>
          <h1 class="couple-names">Анна <span>и</span> Михаил</h1>
          <span class="ornament" aria-hidden="true">♥</span>
          <p class="panel-date">${escapeHtml(project.event.date)}</p>
          <figure class="portrait portrait--hero gold-frame photo-frame--arched">
            <img class="portrait-image" src="./src/assets/wedding-hero.png" alt="Вымышленная пара в саду на закате">
          </figure>
          <p class="panel-note">Дорогие родные и друзья! Мы будем счастливы разделить с вами день, когда начнётся новая глава нашей истории. Сохраните эту дату и приезжайте обнимать нас, улыбаться, говорить тёплые слова и танцевать вместе до самого вечера.</p>
          <p class="muted small">Имена, дата, место и программа на этой странице — демонстрационные.</p>
        </article>

        <div class="story-wave story-wave--cream-olive" aria-hidden="true">
          <img class="wave-botanical wave-botanical--left" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
          <svg viewBox="0 0 1440 96" preserveAspectRatio="none" focusable="false"><path fill="currentColor" d="M0,48 C116,78 238,76 358,47 C525,7 654,19 791,54 C950,94 1110,83 1245,44 C1338,17 1397,18 1440,26 L1440,96 L0,96 Z" /></svg>
        </div>

        <article id="program" class="invitation-panel invitation-panel--program">
          <img class="botanical botanical--program" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
          <p class="panel-kicker">Наш день</p>
          <h2>Программа</h2>
          <span class="ornament" aria-hidden="true">♥</span>
          <ol class="schedule schedule--panel">
            ${(program?.schedule || []).map((entry) => `
              <li>
                <span class="schedule-icon">${invitationIcon(entry.icon)}</span>
                <time>${escapeHtml(entry.time)}</time>
                <span class="schedule-content"><strong>${escapeHtml(entry.text)}</strong><small>${escapeHtml(entry.description || "")}</small></span>
              </li>
            `).join("")}
          </ol>
          <div class="program-footer">
            <p class="panel-kicker">Дресс-код</p>
            <p>Нам будет особенно приятно, если вы поддержите спокойную природную палитру праздника. Выбирайте оливковые, шалфейные, кремовые и тёплые бежевые оттенки. Это пожелание, а не строгое правило — главное, чтобы вам было комфортно.</p>
            <div class="dress-palette" role="list" aria-label="Палитра дресс-кода">
              <span class="dress-swatch dress-swatch--olive" role="listitem" aria-label="Тёмный оливковый"></span>
              <span class="dress-swatch dress-swatch--sage" role="listitem" aria-label="Приглушённый шалфейный"></span>
              <span class="dress-swatch dress-swatch--stone" role="listitem" aria-label="Серо-бежевый"></span>
              <span class="dress-swatch dress-swatch--cream" role="listitem" aria-label="Кремовый"></span>
              <span class="dress-swatch dress-swatch--gold" role="listitem" aria-label="Неброский золотистый"></span>
            </div>
          </div>
        </article>

        <div class="story-wave story-wave--olive-cream" aria-hidden="true">
          <img class="wave-botanical wave-botanical--right" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
          <svg viewBox="0 0 1440 96" preserveAspectRatio="none" focusable="false"><path fill="currentColor" d="M0,32 C157,9 264,8 408,34 C555,61 663,82 806,63 C975,40 1035,7 1180,22 C1293,34 1371,62 1440,49 L1440,96 L0,96 Z" /></svg>
        </div>

        <article id="details" class="invitation-panel invitation-panel--guests">
          <img class="botanical botanical--guests" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
          <p class="panel-kicker">Для гостей</p>
          <h2>Где и когда</h2>
          <p class="guest-intro">Мы соберёмся за городом, вдали от городской суеты. Пожалуйста, приезжайте немного заранее, чтобы спокойно познакомиться с площадкой и встретиться с другими гостями.</p>
          <dl class="guest-details">
            <div>
              <dt>${invitationIcon("clock")}<span>Время</span></dt>
              <dd>${escapeHtml(project.event.time)}</dd>
            </div>
            <div>
              <dt>${invitationIcon("pin")}<span>Место</span></dt>
              <dd>${escapeHtml(project.event.place)}</dd>
            </div>
          </dl>
          <p class="guest-demo-note">Адрес указан для демонстрации и будет заменён владельцем перед настоящим запуском.</p>
          <figure class="portrait portrait--dinner gold-frame photo-frame--dinner">
            <img class="portrait-image" src="./src/assets/wedding-dinner.png" alt="Вымышленный праздничный ужин в саду">
          </figure>
          <div class="guest-response">
            <h3>${escapeHtml(guestInfo?.title || "Будете с нами?")}</h3>
            <p>${escapeHtml(guestInfo?.text || "")}</p>
            <a class="button" href="#request">${escapeHtml(project.cta)}</a>
          </div>
        </article>
      </section>

      <div class="story-wave story-wave--cream-sage" aria-hidden="true">
        <img class="wave-botanical wave-botanical--left wave-botanical--sage" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" focusable="false"><path fill="currentColor" d="M0,60 C130,24 237,30 363,52 C522,80 615,80 774,50 C920,23 1039,21 1164,45 C1285,69 1365,74 1440,42 L1440,96 L0,96 Z" /></svg>
      </div>

      <section id="request" class="section response-section">
        <div class="container response-container">
          <div>
            <p class="eyebrow">Ваш ответ</p>
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
            <button class="button" type="submit">${escapeHtml(project.submitCta)}</button>
          </form>
        </div>
      </section>

      <div class="story-wave story-wave--sage-cream" aria-hidden="true">
        <img class="wave-botanical wave-botanical--right wave-botanical--closing-wave" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
        <svg viewBox="0 0 1440 96" preserveAspectRatio="none" focusable="false"><path fill="currentColor" d="M0,38 C119,63 233,78 378,58 C508,40 589,9 719,21 C870,35 970,77 1114,63 C1258,49 1344,21 1440,35 L1440,96 L0,96 Z" /></svg>
      </div>

      <section class="closing-note" aria-label="Завершение приглашения">
        <img class="botanical botanical--closing" src="./src/assets/botanical-hearts.png" alt="" aria-hidden="true">
        ${coupleMonogram(true)}
        <p class="panel-kicker">До встречи</p>
        <p>Спасибо, что заглянули на нашу страницу. Нам очень хочется провести этот день рядом с дорогими людьми — спокойно, тепло и по-настоящему душевно. Будем рады разделить этот праздник вместе с вами.</p>
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
    submitButton.textContent = project.submitCta;
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
      submitButton.textContent = project.submitCta;
    }
  });
}

function renderStory() {
  renderShell({
    title: `Программа — ${project.name}`,
    nav: [
      { href: "#/", label: "Главная", active: false },
      { href: "#request", label: project.cta, active: false },
    ],
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
    nav: [{ href: "#/", label: "Приглашение", active: false }],
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

