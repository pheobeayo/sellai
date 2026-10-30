const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v25.0"}`; // matches the version shown in your app dashboard

function waToken(): string {
  const t = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!t) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");
  return t;
}

/** Send a text reply. Only call this after the vendor approves the draft. */
export async function sendWhatsAppText(to: string, body: string): Promise<{ messageId?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${waToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
  if (!res.ok) throw new Error(`WhatsApp send failed: ${json.error?.message ?? res.status}`);
  return { messageId: json.messages?.[0]?.id };
}

/** Download a voice note: media id -> temporary URL -> bytes. */
export async function downloadWhatsAppMedia(mediaId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${waToken()}` } });
  const info = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!info.url) throw new Error("Could not resolve media URL");
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${waToken()}` } });
  return { bytes: Buffer.from(await file.arrayBuffer()), mimeType: info.mime_type ?? "audio/ogg" };
}
