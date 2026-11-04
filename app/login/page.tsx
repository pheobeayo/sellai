import Image from "next/image";
import Link from "next/link";
import LoginForm from "../../components/login/LoginForm";

export const metadata = {
  title: "Seller login · SellAI",
  description:
    "Log in to your SellAI sales desk with WhatsApp, Facebook or Instagram.",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-[#F7F4EE] text-[#15201B] md:grid-cols-2">
      <aside className="m-3 flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-forest px-5 pb-6 pt-5 md:m-5 md:gap-8 md:rounded-[32px] md:px-11 md:pb-11 md:pt-9">
        <Link
          href="/"
          aria-label="SellAI home"
          className="flex items-center gap-2.5 text-[#F7F4EE] no-underline"
        >
          <span className="flex size-[38px] items-center justify-center rounded-[12px_12px_12px_3px] bg-[#F7F4EE] font-display text-[21px] font-bold text-forest">
            S
          </span>
          <span className="font-display text-[25px] font-bold tracking-[-0.8px]">
            SellAI
          </span>
        </Link>

        <Image
          src="/sellai-login-hero.png"
          alt="A yam seller at his market stall, with a note that 3 buyers are waiting in the inbox"
          width={1416}
          height={1962}
          priority
          sizes="(min-width: 768px) 30vw, 0px"
          className="mx-auto hidden h-auto max-h-[52vh] w-auto md:block"
        />

        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-balance font-display text-[28px] font-bold leading-[1.02] tracking-[-0.8px] text-[#F7F4EE] md:text-[44px] md:tracking-[-1.4px]">
            Your buyers are already asking. Let’s answer them.
          </h1>
          <p className="m-0 hidden max-w-[460px] text-[15px] leading-[1.55] text-[#CDEBDC] md:block">
            Log in with the account your shop runs on. SellAI only reads your
            own posts and messages, through Meta&’s official APIs.
          </p>
        </div>
      </aside>
      <main className="flex items-start justify-center px-5 pb-8 pt-4 md:items-center md:px-16 md:py-10">
        <LoginForm />
      </main>
    </div>
  );
}
