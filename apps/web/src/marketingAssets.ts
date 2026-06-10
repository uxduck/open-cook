export type MarketingFoodAsset = {
  alt: string;
  className: string;
  id: string;
  role: "hero" | "feature" | "ingredient";
  src: string;
};

export const marketingFoodAssets: MarketingFoodAsset[] = [
  {
    id: "hero-feast",
    role: "hero",
    src: "/marketing-assets/hero-feast.webp",
    alt: "Illustrated floating family recipe feast",
    className: "food-hero-feast",
  },
  {
    id: "magic-pot",
    role: "feature",
    src: "/marketing-assets/magic-pot.webp",
    alt: "Illustrated cooking pot with recipe ideas rising from it",
    className: "food-magic-pot",
  },
  {
    id: "storybook-cookbook",
    role: "feature",
    src: "/marketing-assets/storybook-cookbook.webp",
    alt: "Illustrated cookbook with food rising from the pages",
    className: "food-storybook-cookbook",
  },
  {
    id: "lunchbox",
    role: "feature",
    src: "/marketing-assets/lunchbox.webp",
    alt: "Illustrated colorful lunchbox",
    className: "food-lunchbox",
  },
  {
    id: "tomato",
    role: "ingredient",
    src: "/marketing-assets/tomato.webp",
    alt: "Illustrated tomato",
    className: "food-tomato",
  },
  {
    id: "potato",
    role: "ingredient",
    src: "/marketing-assets/potato.webp",
    alt: "Illustrated potato",
    className: "food-potato",
  },
  {
    id: "carrot",
    role: "ingredient",
    src: "/marketing-assets/carrot.webp",
    alt: "Illustrated carrot",
    className: "food-carrot",
  },
  {
    id: "broccoli",
    role: "ingredient",
    src: "/marketing-assets/broccoli.webp",
    alt: "Illustrated broccoli",
    className: "food-broccoli",
  },
  {
    id: "mushroom",
    role: "ingredient",
    src: "/marketing-assets/mushroom.webp",
    alt: "Illustrated mushroom",
    className: "food-mushroom",
  },
  {
    id: "lemon",
    role: "ingredient",
    src: "/marketing-assets/lemon.webp",
    alt: "Illustrated lemon wedge",
    className: "food-lemon",
  },
  {
    id: "garlic",
    role: "ingredient",
    src: "/marketing-assets/garlic.webp",
    alt: "Illustrated garlic bulb",
    className: "food-garlic",
  },
  {
    id: "pasta-shell",
    role: "ingredient",
    src: "/marketing-assets/pasta-shell.webp",
    alt: "Illustrated pasta shell",
    className: "food-pasta-shell",
  },
];

export const marketingHeroAsset = marketingFoodAssets.find(
  (asset) => asset.id === "hero-feast",
);

export const marketingFeatureAssets = marketingFoodAssets.filter(
  (asset) => asset.role === "feature",
);

export const marketingIngredientAssets = marketingFoodAssets.filter(
  (asset) => asset.role === "ingredient",
);
