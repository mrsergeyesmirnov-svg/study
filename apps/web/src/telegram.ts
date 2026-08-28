import WebApp from "@twa-dev/sdk";

export function initTelegram() {
  try {
    WebApp.ready();
    WebApp.expand();
  } catch {
    /* outside Telegram */
  }
}

export function getInitData(): string {
  try {
    return WebApp.initData || "";
  } catch {
    return "";
  }
}

export function getTelegramUser() {
  try {
    return WebApp.initDataUnsafe.user;
  } catch {
    return undefined;
  }
}

export function openTelegramLink(url: string) {
  try {
    WebApp.openTelegramLink(url);
  } catch {
    window.open(url, "_blank");
  }
}

export { WebApp };
