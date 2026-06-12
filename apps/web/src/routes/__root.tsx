import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { SessionProvider } from "../context/SessionProvider";
import appCss from "../styles.css?url";

const siteName = "OpenCook";
const siteDescription =
  "Import the recipes you already trust, keep the originals private, and restyle them for whatever dinner needs to become.";
const defaultOgImage = "https://open-cook.com/icon-512.png";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: siteName },
      { name: "description", content: siteDescription },
      { property: "og:site_name", content: siteName },
      { property: "og:type", content: "website" },
      { property: "og:title", content: siteName },
      { property: "og:description", content: siteDescription },
      { property: "og:image", content: defaultOgImage },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundPage,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SessionProvider>
          <Outlet />
        </SessionProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-(--background) px-6 py-16 text-(--foreground)">
      <section className="mx-auto max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--muted-foreground)">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Page not found</h1>
        <p className="mt-4 text-base leading-7 text-(--muted-foreground)">
          This page is not in OpenCook. Head back home or open your cookbook.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-(--primary) px-5 text-sm font-semibold text-(--primary-foreground)"
            to="/"
          >
            Home
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-(--border) bg-(--card) px-5 text-sm font-semibold text-(--foreground)"
            to="/app"
          >
            Open cookbook
          </Link>
        </div>
      </section>
    </main>
  );
}
