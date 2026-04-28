export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

function apiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
): Promise<TelegramSendResult> {
  try {
    const res = await fetch(apiUrl(config.botToken, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "MarkdownV2",
      }),
    });
    const data = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: String(data.result?.message_id ?? "") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTelegramPhoto(
  config: TelegramConfig,
  caption: string,
  imageBuffer: Buffer,
): Promise<TelegramSendResult> {
  try {
    const form = new FormData();
    form.append("chat_id", config.chatId);
    form.append("caption", caption);
    form.append("parse_mode", "MarkdownV2");
    form.append("photo", new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }), "dashboard.png");

    const res = await fetch(apiUrl(config.botToken, "sendPhoto"), {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: String(data.result?.message_id ?? "") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyTelegramCredentials(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl(token, "getMe"), { method: "POST" });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
