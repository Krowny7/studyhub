// middleware.ts (à la racine du repo)
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!login|api/auth|_next|favicon.ico|robots.txt|sitemap.xml|bg/|images/|public/).*)",
  ],
};
