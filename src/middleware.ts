export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!api/auth|login|cobranca|pagar|_next/static|_next/image|favicon.ico).*)"]
};
