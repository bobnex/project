import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    token: z.string().min(1), subject: z.string().trim().min(1).max(200),
    topic: z.string().trim().max(200), prompt: z.string().trim().max(8000),
    count: z.number().int().min(1).max(10),
  }).parse(input))
  .handler(async ({ data }) => {
    const { requireFirebaseAdmin, requestQuestionPack } = await import("./ai.server");
    try {
      await requireFirebaseAdmin(data.token);
      const apiKey = process.env['OPENAI_API_KEY'];
      if (!apiKey) return { questions: null, error: "The OpenAI key is not configured. Ask the site owner to add it securely." };
      const questions = await requestQuestionPack(data, apiKey, process.env['OPENAI_BASE_URL'] ?? "https://api.openai.com/v1", process.env['OPENAI_MODEL'] ?? "gpt-4o-mini");
      return { questions, error: null };
    } catch (error) {
      return { questions: null, error: error instanceof Error ? error.message : "Question generation failed." };
    }
  });