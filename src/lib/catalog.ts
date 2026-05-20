export type Gender = "Female" | "Male" | "Unisex";
export type Category =
  | "Dress" | "Top" | "Shirt" | "T-Shirt" | "Blazer" | "Jacket"
  | "Hoodie" | "Jeans" | "Skirt" | "Trousers"
  | "Heels" | "Sneakers" | "Boots" | "Handbag" | "Sunglasses" | "Belt";
export type Silhouette =
  | "midi-dress" | "mini-dress" | "maxi-dress" | "blouse" | "shirt" | "tshirt"
  | "blazer" | "biker-jacket" | "hoodie" | "skinny-jeans" | "wide-jeans"
  | "trousers" | "mini-skirt" | "heel" | "sneaker" | "boot" | "handbag" | "sunglasses" | "belt";
export type Aesthetic = "Minimal" | "Streetwear" | "Editorial" | "Romantic" | "Power" | "Sport";
export type Occasion = "Casual" | "Evening" | "Office" | "Party" | "Street" | "Weekend" | "Date";

export type Product = {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  category: Category;
  silhouette: Silhouette;
  color: string;        // primary hex
  accent?: string;
  aesthetic: Aesthetic;
  occasion: Occasion[];
  price: number;
  wearableSlot: "outfit" | "accessory" | "footwear" | "bag"; // mannequin wear slot
};

export const PRODUCTS: Product[] = [
  // Women's outfits
  { id: "zara-pink-dress", name: "Satin Slip Midi Dress", brand: "Zara", gender: "Female", category: "Dress", silhouette: "midi-dress", color: "#ec4f8a", accent: "#f49bbc", aesthetic: "Romantic", occasion: ["Date","Evening","Party"], price: 3990, wearableSlot: "outfit" },
  { id: "hm-black-mini", name: "Crepe Mini Dress", brand: "H&M", gender: "Female", category: "Dress", silhouette: "mini-dress", color: "#111114", accent: "#2a2a30", aesthetic: "Editorial", occasion: ["Party","Evening","Date"], price: 2499, wearableSlot: "outfit" },
  { id: "mango-floral", name: "Floral Maxi Dress", brand: "Mango", gender: "Female", category: "Dress", silhouette: "maxi-dress", color: "#c2436b", accent: "#f3c97a", aesthetic: "Romantic", occasion: ["Weekend","Date","Casual"], price: 4499, wearableSlot: "outfit" },
  { id: "zara-silk-blouse", name: "Silk Tie-Neck Blouse", brand: "Zara", gender: "Female", category: "Top", silhouette: "blouse", color: "#f5e9d6", aesthetic: "Minimal", occasion: ["Office","Date"], price: 2990, wearableSlot: "outfit" },
  { id: "mango-blazer", name: "Oversized Wool Blazer", brand: "Mango", gender: "Female", category: "Blazer", silhouette: "blazer", color: "#3b2a22", accent: "#5a3f30", aesthetic: "Power", occasion: ["Office","Evening"], price: 6990, wearableSlot: "outfit" },
  { id: "levis-mom", name: "High-Rise Mom Jeans", brand: "Levi's", gender: "Female", category: "Jeans", silhouette: "wide-jeans", color: "#5f7a9a", aesthetic: "Streetwear", occasion: ["Casual","Street","Weekend"], price: 4499, wearableSlot: "outfit" },
  { id: "hm-mini-skirt", name: "Pleated Mini Skirt", brand: "H&M", gender: "Female", category: "Skirt", silhouette: "mini-skirt", color: "#2b2b32", aesthetic: "Editorial", occasion: ["Party","Street"], price: 1999, wearableSlot: "outfit" },

  // Men's outfits
  { id: "roadster-tee", name: "Heavyweight Cotton Tee", brand: "Roadster", gender: "Male", category: "T-Shirt", silhouette: "tshirt", color: "#f3f1ec", aesthetic: "Minimal", occasion: ["Casual","Weekend"], price: 899, wearableSlot: "outfit" },
  { id: "zara-oxford", name: "Oxford Button-Down Shirt", brand: "Zara", gender: "Male", category: "Shirt", silhouette: "shirt", color: "#c8d3e1", aesthetic: "Minimal", occasion: ["Office","Date"], price: 2790, wearableSlot: "outfit" },
  { id: "hm-blazer-m", name: "Slim-Fit Tailored Blazer", brand: "H&M", gender: "Male", category: "Blazer", silhouette: "blazer", color: "#1a1a22", aesthetic: "Power", occasion: ["Office","Evening"], price: 5999, wearableSlot: "outfit" },
  { id: "hrx-hoodie", name: "Tech-Fleece Hoodie", brand: "HRX", gender: "Male", category: "Hoodie", silhouette: "hoodie", color: "#212229", accent: "#3b3d48", aesthetic: "Sport", occasion: ["Casual","Street","Weekend"], price: 2299, wearableSlot: "outfit" },
  { id: "levis-501", name: "501 Original Jeans", brand: "Levi's", gender: "Male", category: "Jeans", silhouette: "skinny-jeans", color: "#3a4d68", aesthetic: "Streetwear", occasion: ["Casual","Street"], price: 4999, wearableSlot: "outfit" },
  { id: "zara-trousers", name: "Pleated Wool Trousers", brand: "Zara", gender: "Male", category: "Trousers", silhouette: "trousers", color: "#2d2a26", aesthetic: "Editorial", occasion: ["Office","Evening"], price: 3990, wearableSlot: "outfit" },
  { id: "zara-biker", name: "Leather Biker Jacket", brand: "Zara", gender: "Male", category: "Jacket", silhouette: "biker-jacket", color: "#0d0d10", aesthetic: "Streetwear", occasion: ["Street","Evening"], price: 8999, wearableSlot: "outfit" },

  // Accessories / footwear (gender hints)
  { id: "acc-heels-nude", name: "Pointed Stiletto Heels", brand: "Mango", gender: "Female", category: "Heels", silhouette: "heel", color: "#d8b89a", aesthetic: "Romantic", occasion: ["Evening","Date","Party"], price: 3499, wearableSlot: "footwear" },
  { id: "acc-heels-black", name: "Patent Block Heels", brand: "Zara", gender: "Female", category: "Heels", silhouette: "heel", color: "#0a0a0c", aesthetic: "Editorial", occasion: ["Evening","Office"], price: 3999, wearableSlot: "footwear" },
  { id: "acc-bag-rose", name: "Quilted Mini Bag", brand: "Mango", gender: "Female", category: "Handbag", silhouette: "handbag", color: "#e8a4bc", aesthetic: "Romantic", occasion: ["Date","Party"], price: 2999, wearableSlot: "bag" },
  { id: "acc-bag-black", name: "Structured Tote", brand: "Zara", gender: "Female", category: "Handbag", silhouette: "handbag", color: "#111114", aesthetic: "Minimal", occasion: ["Office","Casual"], price: 4499, wearableSlot: "bag" },
  { id: "acc-jacket-cream", name: "Cropped Bouclé Jacket", brand: "H&M", gender: "Female", category: "Jacket", silhouette: "blazer", color: "#efe6d6", aesthetic: "Romantic", occasion: ["Date","Office"], price: 4999, wearableSlot: "outfit" },
  { id: "acc-sunnies", name: "Oversized Cat-Eye Sunnies", brand: "Mango", gender: "Female", category: "Sunglasses", silhouette: "sunglasses", color: "#1a1a1f", aesthetic: "Editorial", occasion: ["Street","Date"], price: 1999, wearableSlot: "accessory" },
  { id: "acc-sneakers-w", name: "Chunky Court Sneakers", brand: "Nike", gender: "Unisex", category: "Sneakers", silhouette: "sneaker", color: "#f4f3ee", accent: "#ec4f8a", aesthetic: "Streetwear", occasion: ["Casual","Street","Weekend"], price: 6499, wearableSlot: "footwear" },
  { id: "acc-sneakers-m", name: "Air Runner Low", brand: "Nike", gender: "Male", category: "Sneakers", silhouette: "sneaker", color: "#1a1a1f", accent: "#ffffff", aesthetic: "Sport", occasion: ["Casual","Street"], price: 7999, wearableSlot: "footwear" },
  { id: "acc-boots-m", name: "Chelsea Leather Boots", brand: "Zara", gender: "Male", category: "Boots", silhouette: "boot", color: "#2a1a14", aesthetic: "Editorial", occasion: ["Evening","Office"], price: 6999, wearableSlot: "footwear" },
  { id: "acc-belt-m", name: "Saffiano Leather Belt", brand: "Zara", gender: "Male", category: "Belt", silhouette: "belt", color: "#3b1f14", aesthetic: "Minimal", occasion: ["Office","Evening"], price: 1999, wearableSlot: "accessory" },
];

// What complements each category for "complete the look"
const COMPLEMENT_MAP: Record<string, Category[]> = {
  Dress: ["Heels", "Handbag", "Jacket", "Sunglasses"],
  Top: ["Jeans", "Skirt", "Heels", "Handbag"],
  Skirt: ["Top", "Heels", "Handbag", "Jacket"],
  Blazer: ["Trousers", "Jeans", "Heels", "Boots", "Handbag"],
  Shirt: ["Trousers", "Jeans", "Boots", "Belt"],
  "T-Shirt": ["Jeans", "Sneakers", "Jacket"],
  Hoodie: ["Jeans", "Sneakers"],
  Jacket: ["Jeans", "Boots", "Sneakers"],
  Jeans: ["T-Shirt", "Shirt", "Sneakers", "Belt"],
  Trousers: ["Shirt", "Blazer", "Boots", "Belt"],
};

export function findById(id: string) {
  return PRODUCTS.find((p) => p.id === id)!;
}

export function similarProducts(p: Product, n = 4): Product[] {
  return PRODUCTS
    .filter((x) => x.id !== p.id && x.category === p.category && (x.gender === p.gender || x.gender === "Unisex"))
    .slice(0, n);
}

export function completeTheLook(p: Product, n = 4): Product[] {
  const wanted = COMPLEMENT_MAP[p.category] ?? [];
  const picks: Product[] = [];
  for (const cat of wanted) {
    const match = PRODUCTS.find(
      (x) =>
        x.category === cat &&
        (x.gender === p.gender || x.gender === "Unisex") &&
        !picks.includes(x),
    );
    if (match) picks.push(match);
    if (picks.length >= n) break;
  }
  return picks;
}

export function trendingWith(p: Product, n = 4): Product[] {
  return PRODUCTS
    .filter((x) => x.id !== p.id && (x.gender === p.gender || x.gender === "Unisex") && x.aesthetic === p.aesthetic)
    .slice(0, n);
}

export function whyMatches(base: Product, pair: Product): string {
  const sameOcc = base.occasion.find((o) => pair.occasion.includes(o));
  if (sameOcc) return `Built for ${sameOcc.toLowerCase()} — matches the ${base.aesthetic.toLowerCase()} mood.`;
  if (base.aesthetic === pair.aesthetic) return `Same ${pair.aesthetic.toLowerCase()} aesthetic — tonal continuity.`;
  return `Contrast pairing — adds dimension to your ${base.category.toLowerCase()}.`;
}
