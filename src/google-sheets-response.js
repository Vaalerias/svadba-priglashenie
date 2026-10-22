function isAppsScriptOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:"
      && (url.hostname === "script.google.com" || url.hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

export function configuredResponseEndpoint() {
  const endpoint = String(window.AIRC_RUNTIME?.weddingResponse?.endpoint || "").trim();
  if (!endpoint) return null;
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !url.pathname.endsWith("/exec")) {
    throw new Error("Неверный адрес обработчика ответов");
  }
  return url.toString();
}

export function sendResponseToGoogleSheet(endpoint, payload) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const requestField = document.createElement("input");
    const payloadField = document.createElement("input");
    const cleanUp = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      iframe.remove();
      form.remove();
    };
    const onMessage = (event) => {
      // HtmlService выполняет ответ внутри sandbox-iframe и в некоторых браузерах
      // передаёт origin "null". Случайный requestId связывает ответ только с этой отправкой.
      if (event.origin !== "null" && !isAppsScriptOrigin(event.origin)) return;
      const result = event.data;
      if (!result || result.source !== "wedding-rsvp" || result.requestId !== requestId) return;
      cleanUp();
      if (result.ok) resolve();
      else reject(new Error(result.message || "Не удалось сохранить ответ"));
    };
    const timeout = window.setTimeout(() => {
      cleanUp();
      reject(new Error("Не удалось получить подтверждение сохранения"));
    }, 15000);

    iframe.name = `wedding-response-${requestId}`;
    iframe.hidden = true;
    form.action = endpoint;
    form.method = "post";
    form.target = iframe.name;
    form.hidden = true;
    requestField.name = "request_id";
    requestField.value = requestId;
    payloadField.name = "payload";
    payloadField.value = JSON.stringify(payload);
    form.append(requestField, payloadField);
    document.body.append(iframe, form);
    window.addEventListener("message", onMessage);
    form.submit();
  });
}
