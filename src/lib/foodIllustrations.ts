// Hand-drawn food doodles for Baby Food products. When a product's name
// names a food we have a drawing for, the Products list shows that drawing
// instead of the generic baby-food jar (see ProductCard in
// src/routes/_authenticated/products.tsx).
import apple from "@/assets/foods/apple.svg";
import avocado from "@/assets/foods/avocado.svg";
import banana from "@/assets/foods/banana.svg";
import blueberries from "@/assets/foods/blueberries.svg";
import broccoli from "@/assets/foods/broccoli.svg";
import carrot from "@/assets/foods/carrot.svg";
import cheese from "@/assets/foods/cheese.svg";
import egg from "@/assets/foods/egg.svg";
import oatmeal from "@/assets/foods/oatmeal.svg";
import pancakes from "@/assets/foods/pancakes.svg";
import peas from "@/assets/foods/peas.svg";
import pouch from "@/assets/foods/pouch.svg";
import puffs from "@/assets/foods/puffs.svg";
import strawberry from "@/assets/foods/strawberry.svg";
import sweetPotato from "@/assets/foods/sweet-potato.svg";
import toast from "@/assets/foods/toast.svg";
import waffle from "@/assets/foods/waffle.svg";
import yogurt from "@/assets/foods/yogurt.svg";

export type FoodIllustrationKey =
  | "pouch" | "puffs" | "yogurt" | "waffle" | "pancakes" | "toast" | "oatmeal" | "cheese" | "egg"
  | "sweet_potato" | "avocado" | "banana" | "apple" | "strawberry" | "blueberries" | "carrot"
  | "broccoli" | "peas";

// Order matters: the form of the food wins over its flavor, so "Blueberry
// Puffs" is puffs, "Apple & Pear Pouch" is a pouch and "Strawberry Yogurt
// Melts" is yogurt.
const FOODS: { key: FoodIllustrationKey; src: string; pattern: RegExp }[] = [
  { key: "pouch", src: pouch, pattern: /\bpouch(es)?\b/i },
  { key: "puffs", src: puffs, pattern: /\bpuffs?\b/i },
  { key: "yogurt", src: yogurt, pattern: /\byogh?urt\b/i },
  { key: "waffle", src: waffle, pattern: /\bwaffles?\b/i },
  { key: "pancakes", src: pancakes, pattern: /\bpancakes?\b/i },
  { key: "toast", src: toast, pattern: /\btoast\b|\bbread\b/i },
  { key: "oatmeal", src: oatmeal, pattern: /\boat(s|meal)?\b|\bporridge\b|\bcereal\b/i },
  { key: "cheese", src: cheese, pattern: /\bcheese\b/i },
  { key: "egg", src: egg, pattern: /\beggs?\b/i },
  { key: "sweet_potato", src: sweetPotato, pattern: /\bsweet\s*potato(es)?\b|\byams?\b/i },
  { key: "avocado", src: avocado, pattern: /\bavocados?\b/i },
  { key: "banana", src: banana, pattern: /\bbananas?\b/i },
  { key: "apple", src: apple, pattern: /\bapples?\b/i },
  { key: "strawberry", src: strawberry, pattern: /\bstrawberr(y|ies)\b/i },
  { key: "blueberries", src: blueberries, pattern: /\bblueberr(y|ies)\b/i },
  { key: "carrot", src: carrot, pattern: /\bcarrots?\b/i },
  { key: "broccoli", src: broccoli, pattern: /\bbroccoli\b/i },
  { key: "peas", src: peas, pattern: /\bpeas?\b/i },
];

/** The food doodle matching a product name, or null when we don't have one. */
export function foodIllustrationFor(
  name: string | null | undefined,
): { key: FoodIllustrationKey; src: string } | null {
  if (!name) return null;
  const hit = FOODS.find(({ pattern }) => pattern.test(name));
  return hit ? { key: hit.key, src: hit.src } : null;
}
