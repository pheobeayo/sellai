"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Step = "phone" | "waiting";

interface Methods { configured: boolean; whatsapp: boolean; passcode: boolean }

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? "Something went wrong. Try again.");
  return json as T;
}

/** Where to go after login: the page the seller was trying to open, if it's on this site. */
function nextPath(): string {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/inbox";
}

const SoonBadge = () => (
  <span className="ml-auto rounded-full bg-[#F1ECE3] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.6px] text-[#5C635E]">
    Soon
  </span>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<{ code: string; waLink: string; expiresAt: string } | null>(null);
  const [expired, setExpired] = useState(false);
  const [methods, setMethods] = useState<Methods | null>(null);
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");

  const digits = phone.replace(/\D/g, "");
  const fullNumber = `+234${digits.replace(/^0/, "")}`;

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((m: Methods & { signedIn: boolean }) => {
        if (m.signedIn) window.location.replace(nextPath());
        setMethods(m);
      })
      .catch(() => setMethods({ configured: true, whatsapp: true, passcode: false }));
  }, []);

  // While waiting, ask the server every 2 seconds whether the WhatsApp message has arrived.
  useEffect(() => {
    if (step !== "waiting" || !challenge) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/auth/status", { cache: "no-store" }).then((x) => x.json());
        if (stop) return;
        if (r.status === "verified") return window.location.replace(nextPath());
        if (r.status === "expired") return setExpired(true);
      } catch {
        /* network blip: keep polling */
      }
      if (!stop) timer = setTimeout(tick, 2000);
    };
    let timer = setTimeout(tick, 2000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [step, challenge]);

  async function onSendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setExpired(false);
    try {
      const c = await post<{ code: string; waLink: string; expiresAt: string }>("/api/auth/start", { phone: fullNumber });
      setChallenge(c);
      setStep("waiting");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPasscode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/passcode", { passcode });
      window.location.replace(nextPath());
    } catch (err) {
      setError((err as Error).message);
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
          Sign in with the WhatsApp number your shop runs on.
        </p>
      </div>

      {methods && !methods.configured && (
        <p role="alert" className="m-0 rounded-2xl bg-[#FDF0E6] px-4 py-3 text-sm text-[#8A3B12]">
          Login isn&apos;t set up on this server yet: add SESSION_SECRET to the environment.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-[#FDF0E6] px-4 py-3 text-sm font-medium text-[#8A3B12]">
          {error}
        </p>
      )}

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
              {busy ? "Getting your code…" : "Get my login code"}
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
            disabled
            title="Coming soon"
            className={`${metaClass} cursor-not-allowed opacity-60 hover:border-[#E3DACB]`}
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
            <SoonBadge />
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className={`${metaClass} cursor-not-allowed opacity-60 hover:border-[#E3DACB]`}
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
            <SoonBadge />
          </button>

          {methods?.passcode && (
            showPasscode ? (
              <form onSubmit={onPasscode} className="flex flex-col gap-3 rounded-[20px] border-2 border-[#E3DACB] bg-white p-[18px]">
                <label htmlFor="passcode" className="text-[13px] font-bold text-[#5C635E]">Shop passcode</label>
                <div className={fieldClass}>
                  <input
                    id="passcode"
                    type="password"
                    autoComplete="current-password"
                    required
                    autoFocus
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-base font-medium text-[#15201B] outline-none"
                  />
                </div>
                <button type="submit" disabled={busy || !passcode} className={primaryClass}>
                  {busy ? "Checking…" : "Log in with passcode"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowPasscode(true)}
                className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-bold text-forest"
              >
                Have a shop passcode?
              </button>
            )
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3.5 rounded-[20px] border-2 border-forest bg-white p-5">
          <p className="m-0 text-[14.5px] leading-normal">
            To prove it&apos;s you, send this code <strong>from {fullNumber}</strong> to our WhatsApp. It&apos;s valid for 10 minutes.
          </p>
          <div
            aria-label="Your login code"
            className="rounded-2xl bg-[#E2F3EA] py-4 text-center font-display text-[34px] font-bold tracking-[10px] text-forest"
          >
            {challenge?.code}
          </div>
          {!expired ? (
            <>
              <a
                href={challenge?.waLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`${primaryClass} no-underline`}
              >
                Send the code on WhatsApp
              </a>
              <p role="status" className="m-0 flex items-center justify-center gap-2 text-sm text-[#5C635E]">
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-forest" />
                Waiting for your message… this page signs you in by itself.
              </p>
            </>
          ) : (
            <button type="button" onClick={() => onSendCode()} disabled={busy} className={primaryClass}>
              {busy ? "Getting a new code…" : "Code expired. Get a new one"}
            </button>
          )}
          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setStep("phone");
              }}
              className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-forest"
            >
              Change number
            </button>
            {!expired && (
              <button
                type="button"
                onClick={() => onSendCode()}
                className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-[#5C635E] hover:text-[#15201B]"
              >
                New code
              </button>
            )}
          </div>
        </div>
      )}

      <p className="m-0 mt-1 text-sm text-[#5C635E]">
        Just looking?{" "}
        <Link href="/shop" className="font-bold text-forest underline">
          Visit the shop
        </Link>
      </p>
    </div>
  );
}
