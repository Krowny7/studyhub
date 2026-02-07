"use client";

import { CreateAction } from "@/components/CreateAction";

/**
 * Mobile-first floating "+" button.
 * Keeps pages clean for users who only want to review existing content.
 */
export function FloatingCreateAction({
  title,
  buttonLabel,
  children
}: {
  title: string;
  buttonLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-height)+12px)] right-4 z-[70] sm:hidden">
      <CreateAction title={title} buttonLabel={buttonLabel}>
        {children}
      </CreateAction>
    </div>
  );
}
