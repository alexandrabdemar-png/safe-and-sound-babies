// The AAP "top 9" allergens, in a plain module so both the First Foods page
// and the scanner's ingredient helpers can share them without importing a
// route file.
export const TOP_ALLERGENS = [
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Tree nuts",
  "Peanuts",
  "Wheat",
  "Soy",
  "Sesame",
] as const;

export type Allergen = (typeof TOP_ALLERGENS)[number];
