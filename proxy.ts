import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "jelly_planner_auth";

function getExpectedAuthValue() {
  const password = process.env.PLANNER_PASSWORD;

  if (!password) {
    return null;
  }

  return `jelly:${password}`;
}

export function proxy(request: NextRequest) {
  const expectedAuthValue = getExpectedAuthValue();

  if (!expectedAuthValue) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/logo") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (request.cookies.get(AUTH_COOKIE)?.value === expectedAuthValue) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api).*)"]
};
