import "dotenv/config";
import { MODELS, meta } from "@/lib/meta";

// Quick check that your key, base URL and model name work.
const res = await meta().chat.completions.create({
  model: MODELS.agent,
  messages: [{ role: "user", content: "Reply with exactly: SellAI is live" }],
});
console.log(`model: ${res.model}`);
console.log(`reply: ${res.choices[0]?.message?.content}`);
console.log(`tokens: ${JSON.stringify(res.usage)}`);
