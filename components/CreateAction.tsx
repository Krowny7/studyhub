"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

export function CreateAction({
  title,
  buttonLabel,
  iconOnly = true,
  className = "",
  children
}: {
  title: string;
  buttonLabel: string;
  iconOnly?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={
          iconOnly
            ? `btn btn-primary aspect-square h-11 w-11 !rounded-full p-0 shadow-[0_14px_28px_rgba(59,130,246,0.28)] ring-1 ring-blue-400/30 ${className}`
            : `btn btn-primary ${className}`
        }
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => setOpen(true)}
      >
        {iconOnly ? <span className="text-xl leading-none">+</span> : buttonLabel}
      </button>

      <Modal
        open={open}
        title={title}
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-2xl"
      >
        {children}
      </Modal>
    </>
  );
}
