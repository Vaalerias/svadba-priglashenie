const RESPONSE_SHEET_NAME = 'Ответы гостей';
const RESPONSE_HEADERS = [
  'Дата и время ответа',
  'Имя отвечающего',
  'Фамилия отвечающего',
  'Придут',
  'Количество гостей',
  'Имена гостей',
  'Статус',
  'Примечание',
  'Код семьи',
];

function doPost(event) {
  const requestId = String(event && event.parameter && event.parameter.request_id || '');
  try {
    const payload = JSON.parse(String(event && event.parameter && event.parameter.payload || ''));
    const response = normalizeResponse_(payload);
    assertFamilyCode_(response.family_code);
    saveResponse_(response);
    return postMessageResult_(requestId, true, 'saved');
  } catch (error) {
    console.error(error);
    return postMessageResult_(requestId, false, 'Не удалось сохранить ответ. Проверьте поля и повторите попытку.');
  }
}

function normalizeResponse_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Нет данных ответа');
  const clean = (value) => String(value || '').trim();
  const familyCode = clean(payload.family_code);
  const firstName = clean(payload.first_name);
  const lastName = clean(payload.last_name);
  const attendance = clean(payload.attendance);
  const guestCount = Number(payload.guest_count);
  const participants = Array.isArray(payload.participants) ? payload.participants : [];

  if (!/^[A-Za-z0-9_-]{16,80}$/.test(familyCode)) throw new Error('Неверный код семьи');
  if (firstName.length < 2 || lastName.length < 2) throw new Error('Нужно имя и фамилия отвечающего');
  if (!['attending', 'declined'].includes(attendance)) throw new Error('Нужно выбрать участие');
  if (attendance === 'declined') {
    return { family_code: familyCode, first_name: firstName, last_name: lastName, attendance, guest_count: 0, participants: [] };
  }
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) throw new Error('Неверное количество гостей');
  if (participants.length !== guestCount) throw new Error('Количество гостей не совпадает со списком');

  const validParticipants = participants.map((person) => ({
    first_name: clean(person && person.first_name),
    last_name: clean(person && person.last_name),
  }));
  if (validParticipants.some((person) => person.first_name.length < 2 || person.last_name.length < 2)) {
    throw new Error('Нужно имя и фамилия каждого участника');
  }
  return { family_code: familyCode, first_name: firstName, last_name: lastName, attendance, guest_count: guestCount, participants: validParticipants };
}

function assertFamilyCode_(familyCode) {
  const rawCodes = PropertiesService.getScriptProperties().getProperty('FAMILY_CODES');
  const codes = JSON.parse(rawCodes || '[]');
  if (!Array.isArray(codes) || !codes.includes(familyCode)) throw new Error('Неизвестный код семьи');
}

function saveResponse_(response) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Не задана таблица');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Попробуйте отправить ответ ещё раз');
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(RESPONSE_SHEET_NAME);
    if (!sheet) throw new Error('Не найдена вкладка с ответами');
    ensureHeaders_(sheet);
    const headers = sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).getValues()[0];
    const codeColumn = headers.indexOf('Код семьи');
    const rows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, RESPONSE_HEADERS.length).getValues()
      : [];
    const existingIndex = rows.findIndex((row) => row[codeColumn] === response.family_code);
    const rowNumber = existingIndex >= 0 ? existingIndex + 2 : sheet.getLastRow() + 1;
    const participantNames = response.participants.map((person) => `${person.first_name} ${person.last_name}`).join(', ');
    const values = [
      new Date(),
      response.first_name,
      response.last_name,
      response.attendance === 'attending' ? 'Да, придём' : 'Нет, не придём',
      response.guest_count,
      participantNames,
      'Новый',
      '',
      response.family_code,
    ];
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
    sheet.getRange(rowNumber, 1).setNumberFormat('dd.MM.yyyy HH:mm');
    sheet.hideColumns(codeColumn + 1);
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaders_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).getValues()[0];
  if (currentHeaders.join('|') === RESPONSE_HEADERS.join('|')) return;
  sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]);
  sheet.setFrozenRows(1);
}

function postMessageResult_(requestId, ok, message) {
  const payload = JSON.stringify({ source: 'wedding-rsvp', requestId, ok, message });
  const html = `<script>window.top.postMessage(${payload}, '*');</script>`;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
