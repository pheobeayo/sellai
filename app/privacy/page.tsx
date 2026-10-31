export const metadata = { title: "Privacy policy · SellAI" };

/** Public privacy policy and data-deletion instructions (needed to publish the Meta app). */
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760 }}>
      <h1>Privacy policy</h1>
      <p className="sub">SellAI · last updated 31 October 2026</p>

      <section className="panel" style={{ lineHeight: 1.6 }}>
        <h2 style={{ fontSize: 17 }}>What SellAI is</h2>
        <p>
          SellAI is a sales assistant for small online vendors. It reads messages that buyers send to a vendor&apos;s
          WhatsApp Business number, Instagram account or Facebook Page, drafts replies from the vendor&apos;s own
          catalogue, and helps the vendor track orders. It is a hackathon project built for the Meta Global AI Developer Hackathon.
        </p>

        <h2 style={{ fontSize: 17 }}>What we collect</h2>
        <ul>
          <li>Messages and comments sent to the vendor, including voice notes (which are transcribed to text).</li>
          <li>The sender&apos;s name and WhatsApp number or social handle, as provided by Meta.</li>
          <li>Orders created in a conversation: item, delivery city, total and status.</li>
          <li>Product photos and details the vendor uploads.</li>
        </ul>

        <h2 style={{ fontSize: 17 }}>How we use it</h2>
        <ul>
          <li>To draft and send replies on the vendor&apos;s behalf, and only after the vendor approves them unless the vendor turns on autopilot for simple questions.</li>
          <li>To show the vendor which posts lead to sales.</li>
          <li>Message text is processed by Meta&apos;s AI models through the Meta Model API to classify messages and draft replies.</li>
        </ul>
        <p>We do not sell personal data, show ads, or share data with anyone except the service providers needed to run the app (Meta, Vercel for hosting, Supabase for the database).</p>

        <h2 style={{ fontSize: 17 }}>How long we keep it</h2>
        <p>Messages and orders are kept while the vendor uses SellAI, or until deletion is requested.</p>

        <h2 id="data-deletion" style={{ fontSize: 17 }}>Deleting your data</h2>
        <p>
          To have your messages and orders deleted, email <a href="mailto:pheobeayo@gmail.com">pheobeayo@gmail.com</a> with
          the WhatsApp number or social handle you used. We delete the data within 7 days and confirm by email.
        </p>

        <h2 style={{ fontSize: 17 }}>Contact</h2>
        <p>Ifeoluwa Sanni · <a href="mailto:pheobeayo@gmail.com">pheobeayo@gmail.com</a></p>
      </section>
    </main>
  );
}
