export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  chatId: string; // recipient phone number in international format
}

interface WhatsAppResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  text: string,
): Promise<WhatsAppResult> {
  const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: config.chatId,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendWhatsAppPhoto(
  config: WhatsAppConfig,
  imageUrl: string,
  caption?: string,
): Promise<WhatsAppResult> {
  const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: config.chatId,
        type: "image",
        image: { link: imageUrl, caption: caption ?? "" },
      }),
    });
    const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
