import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const recommendationPayloadSchema = z.object({
  user_id: z.string().min(1).max(128),
  height: z.number().finite().min(50).max(280),
  weight: z.number().finite().min(20).max(400),
  gender: z.enum(["Female", "Male", "Unisex"]),
  body_type: z.string().min(1).max(64),
  fit_preference: z.string().min(1).max(64),
  selected_outfit: z.object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(256),
    brand: z.string().min(1).max(128),
    category: z.string().min(1).max(64),
    color: z.string().min(1).max(64),
  }),
});

const feedbackPayloadSchema = z.object({
  user_id: z.string().min(1).max(128),
  product_id: z.string().min(1).max(128),
  recommended_size: z.string().min(1).max(32),
  selected_size: z.string().min(1).max(32),
  fit_rating: z.string().min(1).max(32),
  feedback_text: z.string().max(1000).optional().default(""),
  would_buy: z.boolean(),
  recommendation_accurate: z.boolean(),
  submitted_at: z.string().min(1).max(64),
});

export const submitSmartFitRecommendation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => recommendationPayloadSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env.MAKE_SMARTFIT_WEBHOOK_URL;
    if (!url) {
      console.error("MAKE_SMARTFIT_WEBHOOK_URL is not configured");
      throw new Error("Recommendation service is not configured");
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error("SmartFit webhook network error:", err);
      throw new Error("Recommendation service unreachable");
    }
    if (!res.ok) {
      console.error("SmartFit webhook non-OK:", res.status);
      throw new Error("Recommendation service failed");
    }
    const text = await res.text();
    return { data: text };
  });

export const submitSmartFitFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => feedbackPayloadSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env.MAKE_FEEDBACK_WEBHOOK_URL;
    if (!url) {
      console.error("MAKE_FEEDBACK_WEBHOOK_URL is not configured");
      throw new Error("Feedback service is not configured");
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error("Feedback webhook non-OK:", res.status);
        throw new Error("Feedback service failed");
      }
    } catch (err) {
      console.error("Feedback webhook network error:", err);
      throw new Error("Feedback service unreachable");
    }
    return { ok: true };
  });
