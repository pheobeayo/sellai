# SellAI

**An AI sales desk for small businesses that sell through Instagram, Facebook and WhatsApp, starting with Nigerian vendors.**

In Nigeria, a huge share of retail happens in comment sections and DMs. A vendor posts a wig and gets hundreds of comments: *"HM?"*, *"abeg how much be this one"*, *"una dey deliver Ibadan?"*, *"Elo ni? Mo fe ra"*. Real buyers are buried in casual engagement, written in Pidgin, Yoruba, Igbo, Hausa or a mix. Vendors miss sales because they can't reply fast enough, and they can't tell which posts actually make money.

SellAI:

1. **Finds the buyers.** Triages every comment and DM by buying intent, in the languages Nigerian customers actually write in.
2. **Drafts grounded replies.** A Muse Spark agent looks up the real catalogue, stock and delivery fees with tool calls, then drafts a reply in the customer's own register. Every Naira amount is checked against tool results before the vendor sees the draft.
3. **Turns intent into orders.** When a buyer is ready, the agent creates a draft order and a WhatsApp checkout link carrying an order reference.
4. **Shows which post earned the money.** The reference travels back through WhatsApp, linking every order to the post that produced it.

> Built for the **Meta Global AI Developer Hackathon** (Oct 26 – Nov 4, 2026), theme: *Build for Your World*.
> All code in this repository was written during the hackathon. See the commit history.

## Meta models used

| Job | Model |
|---|---|
| Sales agent: tool calling over catalogue, stock, delivery and orders | Muse Spark (Meta Model API) |
| High-volume comment triage | Muse Spark Open on Baseten (falls back to Muse Spark) |
| WhatsApp voice notes → text | Muse Voice Transcribe |
| Product photo/video → catalogue entry *(in progress)* | SAM 3.1 + Muse Spark vision |
| Catalogue images *(planned)* | Muse Image |

## Architecture

```
Instagram comments ─┐
Facebook comments ──┼─► /api/webhooks/meta ─► normalize ─► enquiries
WhatsApp messages ──┘        (voice notes → Muse Voice Transcribe)
Paste / CSV import ────────► /api/classify
                                   │
                    triage (Muse Spark Open / Muse Spark)
                                   │  prioritised inbox
                                   ▼
                    sales agent (Muse Spark + tools) ─► grounding check ─► vendor approves ─► send
                       search_catalogue · get_product · get_delivery_quote
                       create_order_draft · escalate_to_vendor
                                   │
                    order ref + wa.me checkout link ─► attribution: order ↔ post
```

Key files:

- `src/agent/classify.ts` – batched intent triage with zod-validated JSON and one self-correcting retry
- `src/agent/sales-agent.ts` – tool-calling loop with parallel tool execution and a grounding self-repair step
- `src/agent/tools.ts` – the only source of prices, stock and fees the agent may quote
- `src/agent/grounding.ts` – extracts ₦ amounts (₦75,000 · N5000 · 98k · 103,000 naira) and checks each one came from a tool
- `src/integrations/` – Meta webhook normalization and signature check, WhatsApp send/media/transcribe, attribution links
- `eval/comments.jsonl` – 60 labelled comments in English, Pidgin, Yoruba, Igbo and Hausa

## Run it

```bash
npm install
cp .env.example .env        # add MODEL_API_KEY
npm run ping                # confirms key + model work
npm run selftest            # offline checks, no key needed
npm run eval                # scores the classifier on the labelled set
npm run agent:demo          # runs the agent on 4 realistic messages and prints tool traces
npm run dev                 # http://localhost:3000
```

### Webhooks (optional for the demo)

1. Create an app at developers.facebook.com, add the Instagram, Messenger/Page and WhatsApp products.
2. Expose your dev server (e.g. `ngrok http 3000`) and set the callback URL to `https://<tunnel>/api/webhooks/meta` with `META_WEBHOOK_VERIFY_TOKEN`.
3. Subscribe to `comments` (Instagram), `feed` (Page) and `messages` (WhatsApp). In development mode only accounts with a role on the app trigger events.

The paste/CSV inbox works without any of this, so the demo never depends on a live webhook.

## Guardrails

- The agent never sends anything; every draft waits for the vendor's approval.
- Prices, stock and delivery fees can only come from tool results; ungrounded amounts trigger a self-repair and are flagged in the UI.
- The agent never shares or invents bank details.
- Complaints and refunds always escalate to a human.
- No scraping: only the vendor's own posts and messages through Meta's official APIs.
