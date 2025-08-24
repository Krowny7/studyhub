// app/login/page.tsx
import { Suspense } from "react";
import LoginForm from "./ui/LoginForm";

export const metadata = { title: "Connexion – StudyHub" };
// Empêche la tentative de prerender
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams?: { callbackUrl?: string; error?: string };
};

export default function LoginPage({ searchParams }: Props) {
  const callbackUrl = searchParams?.callbackUrl || "/";
  const error = searchParams?.error;

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 -z-10">
        <video autoPlay muted loop playsInline preload="metadata" className="w-full h-full object-cover" poster="/bg/console.jpg">
          <source src="/bg/background.webm" type="video/webm" />
          <source src="/bg/background.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#0e1116]/75 to-[#111418]/88" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-10">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-[#F0122D] shadow-[0_0_20px_#F0122D]" />
          <h1 className="text-2xl font-extrabold tracking-tight">StudyHub</h1>
        </div>
      </div>

      <div className="relative z-10 grid place-items-center min-h-[70vh] px-4">
        {/* Barrière Suspense */}
        <Suspense fallback={null}>
          <LoginForm callbackUrl={callbackUrl} error={error} />
        </Suspense>
      </div>
    </div>
  );
}
