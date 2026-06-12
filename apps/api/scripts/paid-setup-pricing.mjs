// Configures pricing for the OpenCook products in Paid via the v2 REST API
// (api.agentpaid.io), which exposes credit currencies and product attributes
// that @paid-ai/paid-node 1.7.0 does not. Uses PAID_API_KEY from apps/api/.env.
//
// - credit currency "OpenCook Credits" (key: opencook_credits), 1 credit ≈ £0.02
// - opencook            usage attribute: restyle_generated burns 25 credits
// - opencook-pro        £3.99/mo recurring + 500 credits granted monthly
// - opencook-credits-5  £5 one-time + 250 credits upfront
// - opencook-credits-10 £10 one-time + 500 credits upfront
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [
        line.slice(0, idx).trim(),
        line
          .slice(idx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);

const BASE = "https://api.agentpaid.io/api/v2";

async function api(method, path, body) {
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${env.PAID_API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// --- 1. Credit currency (idempotent by key) ---------------------------------
const currencies = await api("GET", "/credits/currencies");
let currency = (currencies.data ?? []).find((c) => c.key === "opencook_credits");
if (currency) {
  console.log("credit currency exists:", currency.id);
} else {
  currency = await api("POST", "/credits/currencies", {
    name: "OpenCook Credits",
    key: "opencook_credits",
    description:
      "OpenCook spendable credits. Restyle = 25 credits, story = 50 credits (1 credit ≈ £0.02).",
  });
  console.log("created credit currency:", JSON.stringify(currency));
}
const creditsCurrencyId = currency.id ?? currency.data?.id;
if (!creditsCurrencyId)
  throw new Error(`no currency id in ${JSON.stringify(currency)}`);

// --- 2. Product attributes + pricing ----------------------------------------
const products = (await api("GET", "/products")).data ?? [];
const byExternalId = Object.fromEntries(products.map((p) => [p.externalId, p]));

const updates = {
  opencook: {
    active: true,
    productAttributes: [
      {
        name: "Recipe restyle",
        active: true,
        pricing: {
          pricingType: "UsagePrepaidCredits",
          eventName: "restyle_generated",
          signalType: "activity",
          creditsCurrencyId,
          creditCost: 25,
        },
      },
    ],
  },
  "opencook-pro": {
    active: true,
    productAttributes: [
      {
        name: "Chef subscription",
        active: true,
        pricing: {
          pricingType: "RecurringPerUnit",
          billingFrequency: "Monthly",
          billingType: "Advance",
          pricePoints: [{ currency: "GBP", unitPrice: 3.99 }],
        },
        creditBenefits: [
          {
            creditsCurrencyId,
            amount: 500,
            allocationCadence: "monthly",
            creditGrantTiming: "on_payment",
          },
        ],
      },
    ],
  },
  "opencook-credits-5": {
    active: true,
    productAttributes: [
      {
        name: "Credit pack (250 credits)",
        active: true,
        pricing: {
          pricingType: "OneTimePerUnit",
          pricePoints: [{ currency: "GBP", unitPrice: 5 }],
        },
        creditBenefits: [
          {
            creditsCurrencyId,
            amount: 250,
            allocationCadence: "upfront",
            creditGrantTiming: "on_payment",
          },
        ],
      },
    ],
  },
  "opencook-credits-10": {
    active: true,
    productAttributes: [
      {
        name: "Credit pack (500 credits)",
        active: true,
        pricing: {
          pricingType: "OneTimePerUnit",
          pricePoints: [{ currency: "GBP", unitPrice: 10 }],
        },
        creditBenefits: [
          {
            creditsCurrencyId,
            amount: 500,
            allocationCadence: "upfront",
            creditGrantTiming: "on_payment",
          },
        ],
      },
    ],
  },
};

for (const [externalId, update] of Object.entries(updates)) {
  const product = byExternalId[externalId];
  if (!product) {
    console.error(
      `product not found for externalId ${externalId} — run paid-setup-products.mjs first`,
    );
    continue;
  }
  const existingAttrs = product.productAttributes ?? [];
  if (existingAttrs.length) {
    console.log(`skip ${externalId}: already has ${existingAttrs.length} attribute(s)`);
    continue;
  }
  const updated = await api("PUT", `/products/${product.id}`, update);
  console.log(
    `updated ${externalId}:`,
    JSON.stringify({
      id: updated.id ?? product.id,
      active: updated.active,
      attributes: (updated.productAttributes ?? []).map((a) => a.name),
    }),
  );
}

// --- 3. Verify ----------------------------------------------------------------
console.log("\n=== final state ===");
const final = (await api("GET", "/products")).data ?? [];
for (const p of final) {
  console.log(
    JSON.stringify({
      id: p.id,
      externalId: p.externalId,
      name: p.name,
      active: p.active,
      attributes: (p.productAttributes ?? []).map((a) => ({
        name: a.name,
        active: a.active,
      })),
    }),
  );
}
