import { getCollection, type CollectionEntry } from "astro:content";

export type Guide = CollectionEntry<"guides">;

export async function getAllGuides(): Promise<Guide[]> {
  return getCollection("guides");
}

export async function getGuidesBySlug(slugs: string[]): Promise<Guide[]> {
  const all = await getAllGuides();
  return slugs
    .map((s) => all.find((g) => g.slug === s))
    .filter((g): g is Guide => g !== undefined);
}
