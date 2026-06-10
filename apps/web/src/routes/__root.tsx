import {
  createRootRoute,
  HeadContent,
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
