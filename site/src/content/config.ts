import { defineCollection, z } from "astro:content";

const guides = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tool_id: z.enum(["break-even", "affordability", "penalty"]).optional(),
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
