"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidthClass = "max-w-lg"
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // Scroll lock (prevents background scrolling on mobile).
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Focus the close button for accessibility.
    closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-2 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />

      <div
        className={`relative flex w-full flex-col ${maxWidthClass} max-h-[calc(100vh-2rem)] rounded-2xl border border-white/10 bg-black/80 p-4 shadow-xl backdrop-blur sm:mx-4 sm:max-h-[calc(100vh-6rem)] sm:w-[min(720px,100%)] sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{title}</div>
          </div>
          <button ref={closeBtnRef} className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mt-4 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );

  // Render in a portal to avoid layout issues caused by transformed/filtered ancestors.
  return mounted ? createPortal(modal, document.body) : modal;
}
