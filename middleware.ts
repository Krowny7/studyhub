// middleware.ts
export { default } from "next-auth/middleware";

/**
 * Protège toutes les pages (dont "/") et ignore :
 * - l'API ("/api/**")
 * - les assets statiques ("_next/**", fichiers avec extension, favicon, robots, etc.)
 * - la page de login ("/login")
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*|login).*)",
  ],
};
