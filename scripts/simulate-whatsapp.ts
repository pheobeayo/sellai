import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";

/**
 * Sends a real-shaped WhatsApp Cloud API webhook to your running app (npm run dev),
 * signed with META_APP_SECRET if set. It goes through exactly the same code as a real message.
 *
 *   npm run simulate:whatsapp -- "abeg how much be the body wave 18 inches?"
 *   npm run simulate:whatsapp -- --order SA-2YUF            # buyer sends the prefilled checkout message
 *   npm run simulate:whatsapp -- "..." --from 2348012345678 --name "Ada"
 *
 * --from defaults to SIM_WHATSAPP_FROM. Use your own number there if WhatsApp sending is configured,
 * so approved replies actually arrive on your phone.
 */

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) {
    console.error(`--${name} needs a value`);
    process.exit(1);
  }
  args.splice(i, 2);
  return v;
};

const order = flag("order");
const from = flag("from") || process.env.SIM_WHATSAPP_FROM || "2348000000001";
const name = flag("name") || "Test Buyer";
const base = (flag("url") || process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const text = order ? `Hi! I'd like to complete order ${order.toUpperCase()}.` : args.join(" ").trim();

if (!text) {
  console.error('Usage: npm run simulate:whatsapp -- "message text"  |  --order SA-XXXX  [--from 234...] [--name "Ada"]');
  process.exit(1);
}

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "SIMULATED",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "SIMULATED", phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || "SIMULATED" },
            contacts: [{ wa_id: from, profile: { name } }],
            messages: [{ id: `wamid.SIM${randomBytes(8).toString("hex")}`, from, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
          },
        },
      ],
    },
  ],
};

const body = JSON.stringify(payload);
const headers: Record<string, string> = { "Content-Type": "application/json" };
if (process.env.META_APP_SECRET) headers["X-Hub-Signature-256"] = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex");

const res = await fetch(`${base}/api/webhooks/meta`, { method: "POST", headers, body }).catch((e) => {
  console.error(`Could not reach ${base}. Is \`npm run dev\` running?\n${(e as Error).message}`);
  process.exit(1);
});
console.log(`${res.status} ${await res.text()}`);
console.log(`Sent as ${name} (${from}): "${text}"`);
console.log("Triage and the draft run in the background. Check the inbox in a few seconds.");
