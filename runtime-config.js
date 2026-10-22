// Здесь только публичные настройки. Никогда не вставляй Supabase secret key, legacy service_role, API secret или пароль.
window.AIRC_RUNTIME = {
  dataMode: "local", // "local" или "supabase"
  workspaceId: "airc-demo",
  supabase: {
    url: "",
    publishableKey: "",
  },
  weddingResponse: {
    endpoint: "https://script.google.com/macros/s/AKfycbykZScy_alYEcX8PnkngAYiCccYuRgtQwEsTZHhsUqi5iYMhSv40I95P0hUw9Ywt8cZWA/exec",
  },
};
