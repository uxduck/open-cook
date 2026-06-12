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
    className: "",
  },
  {
    id: "magic-pot",
    role: "feature",
    src: "/marketing-assets/magic-pot.webp",
    alt: "Illustrated cooking pot with recipe ideas rising from it",
    className: "",
  },
  {
    id: "storybook-cookbook",
    role: "feature",
    src: "/marketing-assets/storybook-cookbook.webp",
    alt: "Illustrated cookbook with food rising from the pages",
    className: "",
  },
  {
    id: "lunchbox",
    role: "feature",
    src: "/marketing-assets/lunchbox.webp",
    alt: "Illustrated colorful lunchbox",
    className: "",
  },
  {
    id: "tomato",
    role: "ingredient",
    src: "/marketing-assets/tomato.webp",
    alt: "Illustrated tomato",
    className:
      "left-[-8%] top-[20%] [--food-size:78px] [--scroll-x:-46px] [--scroll-y:112px] [--scroll-rotate:-28deg] [animation-delay:-0.8s]",
  },
  {
    id: "potato",
    role: "ingredient",
    src: "/marketing-assets/potato.webp",
    alt: "Illustrated potato",
    className:
      "left-[24%] top-[-24%] [--food-size:92px] [--scroll-x:42px] [--scroll-y:148px] [--scroll-rotate:26deg] [animation-delay:-3.1s]",
  },
  {
    id: "carrot",
    role: "ingredient",
    src: "/marketing-assets/carrot.webp",
    alt: "Illustrated carrot",
    className:
      "right-[7%] top-[12%] [--food-size:104px] [--scroll-x:76px] [--scroll-y:122px] [--scroll-rotate:42deg] [animation-delay:-1.7s]",
  },
  {
    id: "broccoli",
    role: "ingredient",
    src: "/marketing-assets/broccoli.webp",
    alt: "Illustrated broccoli",
    className:
      "right-[27%] top-[58%] [--food-size:92px] [--scroll-x:-68px] [--scroll-y:170px] [--scroll-rotate:-34deg] [animation-delay:-4.2s]",
  },
  {
    id: "mushroom",
    role: "ingredient",
    src: "/marketing-assets/mushroom.webp",
    alt: "Illustrated mushroom",
    className:
      "left-[26%] top-[108%] [--food-size:72px] [--scroll-x:54px] [--scroll-y:126px] [--scroll-rotate:20deg] [animation-delay:-2.5s]",
  },
  {
    id: "lemon",
    role: "ingredient",
    src: "/marketing-assets/lemon.webp",
    alt: "Illustrated lemon wedge",
    className:
      "right-[2%] top-[72%] [--food-size:70px] [--scroll-x:-62px] [--scroll-y:98px] [--scroll-rotate:-24deg] [animation-delay:-0.2s]",
  },
  {
    id: "garlic",
    role: "ingredient",
    src: "/marketing-assets/garlic.webp",
    alt: "Illustrated garlic bulb",
    className:
      "left-[47%] top-[82%] [--food-size:76px] [--scroll-x:52px] [--scroll-y:104px] [--scroll-rotate:22deg] [animation-delay:-5s]",
  },
  {
    id: "pasta-shell",
    role: "ingredient",
    src: "/marketing-assets/pasta-shell.webp",
    alt: "Illustrated pasta shell",
    className:
      "left-[-8%] top-[90%] [--food-size:66px] [--scroll-x:-40px] [--scroll-y:88px] [--scroll-rotate:-38deg] [animation-delay:-3.7s]",
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
