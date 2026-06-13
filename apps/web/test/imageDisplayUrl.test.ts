import { describe, expect, it } from "vitest";
import { displayImageUrl } from "../src/imageDisplayUrl";

const localLocation = {
  hostname: "localhost",
  href: "http://localhost:5173/",
  origin: "http://localhost:5173",
};

describe("displayImageUrl", () => {
  it("routes OpenCook managed image-domain URLs through the local API in dev", () => {
    expect(
      displayImageUrl(
        "https://images.open-cook.com/stashcook-b763aee9-cb7f-4e2c-b226-fd87cf2d2554-3766af51370dfb53.webp",
        localLocation,
      ),
    ).toBe(
      "/api/assets/images/stashcook-b763aee9-cb7f-4e2c-b226-fd87cf2d2554-3766af51370dfb53.webp",
    );
  });

  it("uses the local API route during dev SSR", () => {
    expect(displayImageUrl("https://images.open-cook.com/aubergine.webp")).toBe(
      "/api/assets/images/aubergine.webp",
    );
  });

  it("keeps third-party image URLs unchanged in dev", () => {
    expect(displayImageUrl("https://example.com/recipe.webp", localLocation)).toBe(
      "https://example.com/recipe.webp",
    );
  });

  it("routes remote API image URLs through the same local origin in dev", () => {
    expect(
      displayImageUrl(
        "http://127.0.0.1:8787/api/assets/images/aubergine.webp",
        localLocation,
      ),
    ).toBe("/api/assets/images/aubergine.webp");
  });

  it("leaves production OpenCook image URLs unchanged", () => {
    const productionLocation = {
      hostname: "open-cook.com",
      href: "https://open-cook.com/",
      origin: "https://open-cook.com",
    };
    const imageUrl = "https://images.open-cook.com/aubergine.webp";

    expect(displayImageUrl(imageUrl, productionLocation)).toBe(imageUrl);
  });
});
