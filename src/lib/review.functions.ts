import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AiReviewInput = z.object({
  code: z.string().min(1).max(40000),
  filename: z.string().default("pasted_code.py"),
});

export interface AiReview {
  available: boolean;
  message?: string;
  summary: string;
  aiScore: number | null;
  notes: string[];
  improvedCode: string;
}

const SYSTEM_PROMPT = `You are a senior Python code reviewer.
Review the given Python file for bugs, security risks, performance problems,
readability and PEP 8 style. Be concrete and beginner friendly.

Reply with ONLY valid JSON in this exact shape:
{
  "summary": "2-4 sentence plain-English verdict",
  "score": 0-100 integer quality score,
  "notes": ["short actionable bullet", "..."],
  "improved_code": "the full rewritten Python file"
}
No markdown fences, no commentary outside the JSON.`;

/** Extract a JSON object from a model reply that may contain fences or prose. */
function parseJsonReply(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "```").split("```").join("\n");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const aiReviewCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AiReviewInput.parse(input))
  .handler(async ({ data }): Promise<AiReview> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    const empty: AiReview = {
      available: false,
      summary: "",
      aiScore: null,
      notes: [],
      improvedCode: "",
    };

    if (!apiKey) {
      return { ...empty, message: "AI review is not configured on this server." };
    }

    const gateway = createLovableAiGatewayProvider(apiKey);

    try {
      const result = streamText({
        model: gateway("google/gemini-3.7-flash"),
        system: SYSTEM_PROMPT,
        prompt: `File: ${data.filename}\n\n${data.code}`,
      });
      const text = await result.text;
      const parsed = parseJsonReply(text);

      if (!parsed) {
        return {
          available: true,
          summary: text.slice(0, 2000),
          aiScore: null,
          notes: [],
          improvedCode: "",
        };
      }

      const rawScore = Number(parsed["score"]);
      return {
        available: true,
        summary: String(parsed["summary"] ?? ""),
        aiScore: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null,
        notes: Array.isArray(parsed["notes"]) ? parsed["notes"].map(String).slice(0, 20) : [],
        improvedCode: String(parsed["improved_code"] ?? ""),
      };
    } catch (error) {
      const status = (error as { statusCode?: number; status?: number })?.statusCode
        ?? (error as { status?: number })?.status;
      const message =
        status === 429
          ? "AI review is rate limited right now — please retry in a moment."
          : status === 402
            ? "AI credits are exhausted for this workspace. Add credits to re-enable AI review."
            : `AI review failed: ${(error as Error).message}`;
      return { ...empty, message };
    }
  });
