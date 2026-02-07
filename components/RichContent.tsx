"use client";

import React from "react";

// Lightweight rich content renderer.
// Supports plain text + inline image blocks via:
//   [[img:https://...]]
// on its own line.

function isImgLine(line: string) {
  const m = line.trim().match(/^\[\[img:(.+)\]\]$/i);
  if (!m) return null;
  const url = m[1].trim();
  if (!url) return null;
  return url;
}

export function RichContent({ text }: { text: string | null | undefined }) {
  const value = (text ?? "").toString();
  if (!value) return null;

  const lines = value.split("\n");

  return (
    <div className="min-w-0">
      {lines.map((line, idx) => {
        const url = isImgLine(line);
        if (url) {
          // eslint-disable-next-line @next/next/no-img-element
          return (
            <div key={`img-${idx}`} className="my-3">
              <img
                src={url}
                alt=""
                className="max-h-[420px] w-full rounded-xl border border-white/10 object-contain bg-neutral-950/40"
                loading="lazy"
              />
            </div>
          );
        }

        // Normal text line
        return (
          <div
            key={`txt-${idx}`}
            className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}
