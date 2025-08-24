// app/login/page.tsx
import LoginForm from "./ui/LoginForm";

// Empêche le pré-rendu statique de /login (fix Vercel)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Search = {
  callbackUrl?: string;
  error?: string;
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const callbackUrl = (searchParams?.callbackUrl as string) || "/";
  const error = (searchParams?.error as string) || undefined;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="absolute inset-0 -z-10">
        <video autoPlay muted loop playsInline preload="metadata" className="w-full h-full object-cover" poster="/bg/console.jpg">
          <source src="/bg/background.webm" type="video/webm" />
          <source src="/bg/background.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <LoginForm callbackUrl={callbackUrl} error={error} />
    </div>
  );
}
