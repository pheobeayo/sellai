"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type Step = "phone" | "code";

async function sendWhatsAppCode(_phone: string) {}
async function verifyWhatsAppCode(_phone: string, _code: string) {}
function continueWithMeta(_provider: "facebook" | "instagram") {}

const Chevron = () => (
  <svg
    aria-hidden
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#5C635E"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="ml-auto"
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const fieldClass =
  "flex h-14 items-center overflow-hidden rounded-2xl border-2 border-[#E3DACB] bg-white focus-within:border-forest";
const primaryClass =
  "flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-0 bg-forest text-base font-bold text-[#F7F4EE] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const metaClass =
  "flex h-14 w-full cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-[#E3DACB] bg-white px-5 text-[15px] font-bold text-[#15201B] transition hover:border-[#15201B]";

export default function LoginForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const fullNumber = `+234${digits.replace(/^0/, "")}`;

  async function onSendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendWhatsAppCode(fullNumber);
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await verifyWhatsAppCode(fullNumber, code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[18px]">
      <div>
        <h2 className="m-0 mb-1.5 font-display text-[28px] font-bold tracking-[-1px] md:text-[34px]">
          Seller login
        </h2>
        <p className="m-0 text-[15px] text-[#5C635E]">
          Choose where you sell most.
        </p>
      </div>

      {step === "phone" ? (
        <>
          <form
            onSubmit={onSendCode}
            className="flex flex-col gap-3 rounded-[20px] border-2 border-forest bg-white p-[18px]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#E2F3EA]">
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
                  <path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z" />
                  <path d="M9.5 9.5c.5 2 2 3.5 4 4" />
                </svg>
              </span>
              <span className="text-[15.5px] font-bold">
                Log in with WhatsApp
              </span>
              <span className="ml-auto rounded-full bg-[#E2F3EA] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.6px] text-[#1F5A44]">
                Fastest
              </span>
            </div>

            <label
              htmlFor="wa-phone"
              className="text-[13px] font-bold text-[#5C635E]"
            >
              Your WhatsApp business number
            </label>
            <div className={fieldClass}>
              <span className="flex h-[60%] items-center border-r-[1.5px] border-[#E3DACB] pl-4 pr-3 font-bold text-[#5C635E]">
                +234
              </span>
              <input
                id="wa-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="801 234 5678"
                required
                pattern="[0-9 ]{10,12}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-base font-medium text-[#15201B] outline-none"
              />
            </div>
            <button type="submit" disabled={busy} className={primaryClass}>
              {busy ? "Sending…" : "Send me a code"}
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>

          <div className="flex items-center gap-3 text-[13px] text-[#5C635E]">
            <span className="h-px flex-1 bg-[#E3DACB]" />
            or continue with
            <span className="h-px flex-1 bg-[#E3DACB]" />
          </div>

          <button
            type="button"
            onClick={() => continueWithMeta("facebook")}
            className={metaClass}
          >
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#EAF0FB]">
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2D5BB9"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6" />
              </svg>
            </span>
            Continue with Facebook
            <Chevron />
          </button>
          <button
            type="button"
            onClick={() => continueWithMeta("instagram")}
            className={metaClass}
          >
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#FBEAF0]">
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#B5306A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r=".8" fill="#B5306A" />
              </svg>
            </span>
            Continue with Instagram
            <Chevron />
          </button>
        </>
      ) : (
        <form
          onSubmit={onVerify}
          className="flex flex-col gap-3.5 rounded-[20px] border-2 border-forest bg-white p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-[#E2F3EA]">
              <svg
                aria-hidden
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1F5A44"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <p className="m-0 text-[14.5px] leading-normal">
              We sent a 6-digit code to <strong>{fullNumber}</strong> on
              WhatsApp.
            </p>
          </div>

          <label
            htmlFor="wa-code"
            className="text-[13px] font-bold text-[#5C635E]"
          >
            Login code
          </label>
          <div className={fieldClass}>
            <input
              id="wa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-center text-[22px] font-bold tracking-[10px] text-[#15201B] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className={primaryClass}
          >
            {busy ? "Checking…" : "Log in to my sales desk"}
          </button>
          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setCode("");
                setStep("phone");
              }}
              className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-forest"
            >
              Change number
            </button>
            <button
              type="button"
              onClick={() => sendWhatsAppCode(fullNumber)}
              className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-[#5C635E] hover:text-[#15201B]"
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      <p className="m-0 mt-1 text-sm text-[#5C635E]">
        New to SellAI?{" "}
        <Link href="/inbox" className="font-bold text-forest underline">
          Set up your shop
        </Link>
      </p>
    </div>
  );
}
