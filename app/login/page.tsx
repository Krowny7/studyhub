// app/login/page.tsx
import { Suspense } from "react";
import { LoginForm } from "./ui/LoginForm";

export const dynamic = "force-dynamic"; // utile avec l'auth pour éviter le prerender strict

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center text-white/80">
          Chargement…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
