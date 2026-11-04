import Image from "next/image";
import Link from "next/link";
import { seedVendor } from "@/store/seed";
import Header from "../components/Header";
import Footer from "../components/Footer";

function waLink(text: string) {
  const number = (
    process.env.VENDOR_WHATSAPP_NUMBER || seedVendor.whatsappNumber
  ).replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

const steps = [
  {
    title: "Photo to listing",
    body: "Snap a product. It is named, cut out and turned into a studio shot. You set the price.",
    icon: "camera",
  },
  {
    title: "Finds the buyers",
    body: "Every comment and DM is sorted by buying intent. Spam out, complaints flagged.",
    icon: "target",
  },
  {
    title: "Replies from your real data",
    body: "Price, stock and delivery are looked up first. A made-up price or bank number is blocked.",
    icon: "chat",
  },
  {
    title: "Shows which post made money",
    body: "Checkout links tie every order back to the post that started it.",
    icon: "chart",
  },
] as const;

const models = ["Muse Spark 1.3", "Muse Voice", "SAM 3.1", "Muse Image"];

function StepIcon({ name }: { name: (typeof steps)[number]["icon"] }) {
  const paths = {
    camera: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    chat: (
      <path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z" />
    ),
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  };
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1F5A44"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export default function Home() {
  const shop = seedVendor.businessName;

  return (
    <div className="text-[#15201B] w-[90%] mx-auto">
      <Header />
      <main className="flex justify-between items-center lg:flex-row md:flex-row flex-col mt-[96px] mb-6 md:mt-[112px]">
        <div className="lg:w-[35%] md:w-[35%] w-full">
          <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1.4px] text-[#B4471F] md:text-[12.5px] md:tracking-[2px]">
            For Instagram, Facebook and WhatsApp vendors
          </p>
          <h1 className="m-0 text-balance font-display text-[35px] lg:text-[52px] md:text-[48px] font-black leading-none tracking-[-1.2px]">
            Never miss a buyer in your comments again.
          </h1>
          <p className="my-4 text-sm leading-normal text-[#5C635E] text-[18px] md:leading-[1.55] xl:text-base">
            SellAI reads every comment, DM and voice note, finds the real
            buyers, and drafts replies from your actual prices and stock.
            <span className="hidden md:inline">
              {" "}
              In Pidgin, Yoruba, Igbo, Hausa or English.
            </span>
          </p>
        </div>
        <div className="lg:w-[45%] md:w-[45%] w-full">
          <Image
            src="/sellai-hero.png"
            alt="Two women trading at a market, with a buyer's Instagram comment, a SellAI reply draft and an order link"
            width={1962}
            height={1542}
            priority
            sizes="(min-width: 1280px) 45vw, (min-width: 768px) 50vw, 100vw"
            className="h-full max-h-full w-auto max-w-full object-contain md:h-auto md:w-full xl:max-h-[92%] xl:w-auto"
          />
        </div>

        <div className="lg:w-[20%] md:w-[20%] w-full">
          <Link
            href="/inbox"
            className="relative bg-forest px-3.5 py-3 text-[#F7F4EE] no-underline transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(31,90,68,0.6)] motion-reduce:transition-none rounded-[20px] flex flex-col my-3"
          >
            <span className="text-[10.5px] font-bold uppercase tracking-[0.8px]">
              I sell online
            </span>
            <span className="font-display text-[13px] font-bold tracking-[-0.4px] md:text-xl">
              Open my sales desk
            </span>
            <span className="hidden text-[13px] text-[#DCEFE5] md:block">
              Inbox, catalogue, dashboard
            </span>
            <ArrowUpRight className="absolute right-4 top-4 hidden md:block" />
          </Link>
          <a
            href={waLink(`Hi ${shop}! I found you on SellAI.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex flex-col rounded-2xl border-2 border-[#E3DACB] bg-white px-3.5 py-3 text-[#15201B] no-underline transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(31,90,68,0.45)] focus-visible:outline-[#B4471F] motion-reduce:transition-none md:rounded-[20px]"
          >
            <span className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-[#B4471F]">
              I want to buy
            </span>
            <span className="font-display text-[15px] font-bold tracking-[-0.4px] md:text-xl">
              Chat with a vendor
            </span>
            <span className="hidden text-[13px] text-[#5C635E] md:block">
              On WhatsApp, replies in minutes
            </span>
            <ArrowUpRight className="absolute right-4 top-4 hidden md:block" />
          </a>
          <div className="mt-1.5 hidden flex-wrap gap-1.5 text-[11.5px] text-[#5C635E] xl:flex">
            <span className="w-full font-medium">Built with</span>
            {models.map((m) => (
              <span
                key={m}
                className="rounded-full bg-[#EFE6D8] px-2.5 py-1.25 font-bold text-[#15201B]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </main>
      <section
        id="how"
        aria-labelledby="how-title"
        className="scroll-mt-[72px] md:scroll-mt-[88px] flex justify-between items-center rounded-t-[26px] bg-forest py-10 px-4 mb-6 lg:flex-row md:flex-row flex-col"
      >
        <div className="lg:w-[19%] md:w-[19%] w-full mb-3">
          <h2
            id="how-title"
            className="m-0 font-display text-[19px] font-bold leading-[1.05] tracking-[-0.6px] text-[#F7F4EE] md:text-[26px]"
          >
            How it works for sellers
          </h2>
          <p className="m-0 text-[12.5px] leading-normal text-[#CDEBDC]">
            Nothing reaches a buyer until it passes independent checks.
          </p>
        </div>
        <ol className="lg:w-[80%] md:w-[80%] w-full flex justify-between lg:flex-row md:flex-row flex-col">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="rounded-[18px] bg-[#F7F4EE] px-3 py-4 mb-3 lg:w-[24%] md:w-[24%] w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#B4471F]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <StepIcon name={s.icon} />
              </div>
              <h3 className="m-0 text-[15.5px] font-bold">{s.title}</h3>
              <p className="m-0 text-xs leading-[1.45] text-[#5C635E] md:text-[13px]">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <Footer />
    </div>
  );
}
