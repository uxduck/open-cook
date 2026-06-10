// Creates the four OpenCook products in the Paid org for the API key in
// apps/api/.env. Idempotent: skips any product whose externalId already
// exists. Prints the resulting IDs and each product's pricing attributes.
import { readFileSync } from "node:fs";
import { PaidClient } from "@paid-ai/paid-node";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const client = new PaidClient({ token: env.PAID_API_KEY });

const wanted = [
  {
    externalId: "opencook",
    name: "OpenCook",
    description:
      "OpenCook usage attribution product. Not sold directly; usage signals (restyle_generated) attribute to this product.",
  },
  {
    externalId: "opencook-pro",
    name: "OpenCook Chef",
    description:
      "Chef plan: unlimited recipes, 20 restyles/month (500 credits/month), 3 stories/month. £3.99/month.",
  },
  {
    externalId: "opencook-credits-5",
    name: "OpenCook Credits — £5 Pack",
    description: "One-time £5 credit pack: 250 credits (restyle = 25, story = 50).",
  },
  {
    externalId: "opencook-credits-10",
    name: "OpenCook Credits — £10 Pack",
    description: "One-time £10 credit pack: 500 credits (restyle = 25, story = 50).",
  },
];

const existing = (await client.products.listProducts()).data ?? [];
const results = {};

for (const spec of wanted) {
  const found = existing.find((p) => p.externalId === spec.externalId);
  if (found) {
    console.log(`exists: ${spec.externalId} -> ${found.id}`);
    results[spec.externalId] = found.id;
    continue;
  }
  const created = await client.products.createProduct(spec);
  console.log(`created: ${spec.externalId} -> ${created.id}`);
  results[spec.externalId] = created.id;
}

console.log("\n=== product IDs ===");
console.log(JSON.stringify(results, null, 2));

console.log("\n=== pricing attributes per product ===");
for (const [extId, id] of Object.entries(results)) {
  try {
    const pricing = await client.pricing.listPricing({ productId: id });
    console.log(extId, JSON.stringify(pricing, null, 2));
  } catch (e) {
    console.log(extId, "listPricing failed:", e.statusCode ?? "", e.message);
  }
}
