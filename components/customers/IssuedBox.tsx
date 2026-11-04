"use client";

import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import type { Reward } from "@/domain/types";
import Notice from "../seller/Notice";
import { btn, btnGhost, muted } from "../seller/styles";

export interface IssueResult {
  reward: Reward;
  fullMessage: string;
  adjusted?: string;
  delivered: boolean;
  waLink?: string;
  note?: string;
}

export default function IssuedBox({
  r,
  onSent,
}: {
  r: IssueResult;
  onSent: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="success">
        {r.delivered
          ? `Reward ${r.reward.code} given and sent on WhatsApp.`
          : `Reward ${r.reward.code} given.`}
      </Notice>
      {r.adjusted && <p className={`m-0 ${muted}`}>Adjusted: {r.adjusted}</p>}
      {!r.delivered && (
        <>
          {r.note && <p className={`m-0 ${muted}`}>{r.note}</p>}
          <div className="flex flex-wrap gap-2.5">
            {r.waLink && (
              <a
                href={r.waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onSent}
                className={btn}
              >
                <MessageCircle aria-hidden size={16} strokeWidth={2.4} />
                Open WhatsApp
              </a>
            )}
            <button
              type="button"
              className={btnGhost}
              onClick={async () => {
                await navigator.clipboard
                  .writeText(r.fullMessage)
                  .catch(() => {});
                setCopied(true);
                onSent();
              }}
            >
              <Copy aria-hidden size={16} strokeWidth={2.4} />
              {copied ? "Copied" : "Copy message"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
