import { describe, expect, it } from "vitest";
import { buildRobotsTxt, buildSitemapXml } from "../src/server/crawler";

describe("crawler responses", () => {
  it("points crawlers at the sitemap and keeps app-only routes out", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("Sitemap: https://open-cook.com/sitemap.xml");
    expect(robots).toContain("Disallow: /app");
  });

  it("escapes sitemap entries", () => {
    const sitemap = buildSitemapXml([
      {
        lastmod: "2026-06-10T08:00:00.000Z",
        loc: "https://open-cook.com/r/u1/apple&pear",
      },
    ]);
    expect(sitemap).toContain(
      "<loc>https://open-cook.com/r/u1/apple&amp;pear</loc>",
    );
    expect(sitemap).toContain("<lastmod>2026-06-10T08:00:00.000Z</lastmod>");
  });
});
