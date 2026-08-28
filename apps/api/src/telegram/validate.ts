import crypto from "node:crypto";
import { env } from "../env.js";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export function validateInitData(initData: string): TelegramUser | null {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.BOT_TOKEN)
    .digest();

  const calculated = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculated !== hash) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
}

export function parseInitDataUser(initData: string | undefined): TelegramUser | null {
  if (!initData) return null;
  return validateInitData(initData);
}
