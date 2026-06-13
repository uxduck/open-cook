type ImageDisplayLocation = Pick<Location, "hostname" | "href" | "origin">;

const localImageRoute = "/api/assets/images/";
const openCookImageHost = "images.open-cook.com";

export function displayImageUrl(
  imageUrl?: string,
  currentLocation = browserLocation(),
) {
  if (!imageUrl || !currentLocation || !isLocalHost(currentLocation.hostname)) {
    return imageUrl;
  }

  try {
    const url = new URL(imageUrl, currentLocation.href);

    if (url.hostname === openCookImageHost) {
      const key = url.pathname.replace(/^\/+/, "");
      return key ? `${localImageRoute}${key}${url.search}` : imageUrl;
    }

    if (
      url.origin !== currentLocation.origin &&
      url.pathname.startsWith(localImageRoute)
    ) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

function browserLocation(): ImageDisplayLocation | undefined {
  if (typeof window !== "undefined") {
    return window.location;
  }

  if (import.meta.env.DEV) {
    return {
      hostname: "localhost",
      href: "http://localhost/",
      origin: "http://localhost",
    };
  }

  return undefined;
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}
