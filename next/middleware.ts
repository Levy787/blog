import { match as matchLocale } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { i18n } from "@/i18n.config";

function getLocale(request: NextRequest): string | undefined {
  const negotiatorHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

  // @ts-ignore locales are readonly
  const locales: string[] = i18n.locales;
  const languages = new Negotiator({ headers: negotiatorHeaders }).languages();

  const locale = matchLocale(languages, locales, i18n.defaultLocale);
  return locale;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // If this is a PostHog relay request, proxy it to PostHog and return early
  if (pathname.startsWith("/my-important-path")) {
    const url = request.nextUrl.clone();
    const hostname = url.pathname.startsWith("/my-important-path/static/")
      ? process.env.NEXT_PUBLIC_POSTHOG_STATIC_HOST as string
      : process.env.NEXT_PUBLIC_POSTHOG_HOST as string;

    const requestHeaders = new Headers(request.headers as HeadersInit);
    requestHeaders.set("host", hostname);

    url.protocol = "https";
    url.hostname = hostname;
    // NextURL.port is a string in some runtimes; set explicitly
    (url as any).port = "443";
    url.pathname = url.pathname.replace(/^\/my-important-path/, "");

    return NextResponse.rewrite(url, {
      headers: requestHeaders,
    });
  }

  const pathnameIsMissingLocale = i18n.locales.every(
    (locale) =>
      !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`,
  );

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(
      new URL(
        `/${locale}${pathname.startsWith("/") ? "" : "/"}${pathname}`,
        request.url,
      ),
    );
  }
}

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: [
    // PostHog relay paths
    "/my-important-path/:path*",
    // All other paths except API and Next internals
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
