import { defineCollection, z } from "astro:content";

const guides = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    /** Optional shorter title for the <title> tag and OG metadata. Falls
     *  back to `title` when absent. Used to keep SERP titles under ~60
     *  chars after the " — Canadian Rates" suffix is appended. */
    seo_title: z.string().optional(),
    description: z.string(),
    tool_id: z
      .enum(["break-even", "affordability", "penalty", "closing-costs"])
      .optional(),
    related_guides: z.array(z.string()).default([]),
    related_terms: z.array(z.string()).default([]),
    last_reviewed_at: z.string(), // ISO date
  }),
});

const termIntros = defineCollection({
  type: "content",
  schema: z.object({
    term: z.string(), // matches Term type in lib/rates
    headline: z.string(),
    last_reviewed_at: z.string(),
  }),
});

export const collections = { guides, "term-intros": termIntros };
