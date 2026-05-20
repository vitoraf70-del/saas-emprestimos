export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/pix|api/webhooks|api/cron|login|cobranca|pagar|_next/static|_next/image|favicon.ico).*)"
  ]
};
