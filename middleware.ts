import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;

  const isProtectedRoute =
    pathname === "/c" ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings");

  if (isProtectedRoute && !isLoggedIn) {
    if (pathname.startsWith("/api/") || req.method === "POST") {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in." },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    // Redirect to default NextAuth signin page
    url.pathname = "/api/auth/signin";
    url.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
