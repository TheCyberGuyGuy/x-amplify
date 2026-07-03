import { NextResponse, type NextRequest } from "next/server";

// Soft shared-password gate in front of the whole portal.
// The real identity check is the X login; this just keeps the link private.
export function middleware(req: NextRequest) {
  const cookie = req.cookies.get("portal_access")?.value;
  if (cookie && cookie === process.env.SITE_PASSWORD) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate everything except the gate itself, the auth/gate APIs, and assets.
  matcher: [
    "/((?!gate|api/gate|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
