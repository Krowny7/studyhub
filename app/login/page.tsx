// app/login/page.tsx
import { Suspense } from "react";
import LoginForm from "./ui/LoginForm";

// Empêche la génération statique de /login
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: {
    callbackUrl?: string;
    error?: string;
  };
};

export default function LoginPage({ searchParams }: PageProps) {
  const callbackUrl = searchParams?.callbackUrl ?? "/";
  const error = searchParams?.error ?? undefined;

  return (
    <main className="min-h-screen grid place-items-center relative">
      {/* fond simple (tu peux mettre ta vidéo si tu veux) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-[#0e1116] to-[#111418]" />
      <Suspense fallback={<div className="text-gray-400">Chargement…</div>}>
        <LoginForm callbackUrl={callbackUrl} error={error} />
      </Suspense>
    </main>
  );
}
