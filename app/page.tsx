import Link from "next/link";
import type { Product } from "@/domain/types";
import { seedVendor } from "@/store/seed";
import { store } from "@/store/store";
import "./landing.css";

export const dynamic = "force-dynamic"; // the shop shows the live catalogue

export const metadata = {
  title: "SellAI · Never miss a buyer in your comments",
  description: "An AI sales desk for vendors who sell on Instagram, Facebook and WhatsApp. Built on Meta's models.",
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function waLink(text: string) {
  const number = (process.env.VENDOR_WHATSAPP_NUMBER || seedVendor.whatsappNumber).replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

async function loadProducts(): Promise<Product[]> {
  try {
    return (await store.products()).slice(0, 6);
  } catch {
    return []; // the landing page must never fail because the database is down
  }
}

export default async function Landing() {
  const products = await loadProducts();
  const shop = seedVendor.businessName;

  return (
    <div className="lp">
      <header className="lp-top">
        <Link href="/" className="lp-brand"><span className="lp-mark">S</span>SellAI</Link>
        <nav>
          <a href="#shop">Shop</a>
          <a href="#how">How it works</a>
          <Link href="/inbox" className="lp-pill">Seller login</Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-kicker">For Instagram, Facebook and WhatsApp vendors</p>
          <h1>Never miss a buyer in your comments again.</h1>
          <p className="lp-lede">
            SellAI reads every comment, DM and voice note, finds the real buyers, and drafts replies from your actual
            prices and stock, in Pidgin, Yoruba, Igbo, Hausa or English. You approve, it sends, and every sale is traced
            back to the post that made it.
          </p>

          <div className="lp-paths">
            <Link href="/inbox" className="lp-path lp-path-seller">
              <span className="lp-path-label">I sell online</span>
              <strong>Open my sales desk</strong>
              <span className="lp-path-sub">Inbox, catalogue and sales dashboard</span>
              <span className="lp-arrow" aria-hidden>→</span>
            </Link>
            <a href={waLink(`Hi ${shop}! I found you on SellAI.`)} className="lp-path lp-path-buyer" target="_blank" rel="noopener noreferrer">
              <span className="lp-path-label">I want to buy</span>
              <strong>Chat with {shop}</strong>
              <span className="lp-path-sub">On WhatsApp, replies in minutes</span>
              <span className="lp-arrow" aria-hidden>→</span>
            </a>
          </div>
        </div>

        <div className="lp-phone" aria-label="Example WhatsApp conversation">
          <div className="lp-phone-bar"><span className="lp-dot" />{shop}<em>online</em></div>
          <div className="lp-chat">
            <p className="lp-in">Abeg how much be the bone straight 24 inches? I dey Ibadan 🙏</p>
            <p className="lp-out">
              Bone Straight 24 inches na ₦98,000, e dey in stock. Delivery to Ibadan na ₦4,500. You wan make I pack am?
              <span className="lp-checks">✓ prices from your catalogue · 8 checks passed</span>
            </p>
            <p className="lp-in lp-voice"><span aria-hidden>🎙</span> 0:07 · “I go take am, send the link”</p>
            <p className="lp-out">
              Order SA-7KQ2: ₦102,500 total. Tap to confirm: <u>sellai.app/o/SA-7KQ2</u>
            </p>
          </div>
        </div>
      </section>

      <section id="shop" className="lp-section">
        <div className="lp-head">
          <h2>Shop {shop}</h2>
          <p>Live catalogue. Tap a product to ask about it on WhatsApp. SellAI answers with the real price and delivery fee.</p>
        </div>
        {products.length ? (
          <div className="lp-products">
            {products.map((p) => {
              const inStock = p.variants.filter((v) => v.stock > 0);
              const from = Math.min(...(inStock.length ? inStock : p.variants).map((v) => v.priceNaira));
              return (
                <a key={p.id} className="lp-product" href={waLink(`Hi! How much is the ${p.name}?`)} target="_blank" rel="noopener noreferrer">
                  <div className="lp-product-img">
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" /> : <span>{p.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>}
                  </div>
                  <strong>{p.name}</strong>
                  <span className="lp-price">from {naira(from)}</span>
                  <span className={inStock.length ? "lp-stock" : "lp-stock out"}>
                    {inStock.length ? `${inStock.map((v) => v.label).join(" · ")}` : "Sold out"}
                  </span>
                  <span className="lp-ask">Ask on WhatsApp →</span>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="lp-muted">The catalogue is loading. <a href={waLink(`Hi ${shop}!`)}>Message the shop on WhatsApp</a> in the meantime.</p>
        )}
      </section>

      <section id="how" className="lp-section">
        <div className="lp-head">
          <h2>How it works for sellers</h2>
          <p>Every step runs on Meta&apos;s models, and nothing reaches a buyer until it passes independent checks.</p>
        </div>
        <ol className="lp-steps">
          <li><b>Finds the buyers</b><span>Triage sorts every comment and DM by buying intent, in the languages your customers actually write. Spam out, complaints flagged.</span></li>
          <li><b>Replies from your real data</b><span>The agent looks up price, stock and delivery before it writes. A reply with a made-up price or a bank number is blocked.</span></li>
          <li><b>Photo to listing</b><span>Snap a product. It is named, cut out and turned into a clean studio shot. You only set the price.</span></li>
          <li><b>Shows which post made money</b><span>Checkout links tie every order back to the post that started it, from comment to paid.</span></li>
        </ol>
      </section>

      <section className="lp-models">
        <span>Built with</span>
        <b>Muse Spark 1.3</b><b>Muse Voice Transcribe</b><b>SAM 3.1</b><b>Muse Image</b>
      </section>

      <footer className="lp-foot">
        <span>SellAI · built for the Meta Global AI Developer Hackathon 2026</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/inbox">Seller login</Link></span>
      </footer>
    </div>
  );
}
