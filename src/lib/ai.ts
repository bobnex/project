import { getFirebase } from "./firebase";
import { generateQuestions } from "./ai.functions";
import type { GeneratedQuestion } from "./ai-validation";
export type { GeneratedQuestion } from "./ai-validation";

export async function generateQuestionPack(input: {
  subject: string;
  topic?: string;
  prompt: string;
  count?: number;
}): Promise<GeneratedQuestion[]> {
  const subject = input.subject.trim() || "General Knowledge";
  const topic = input.topic?.trim() || "General";
  const count = Math.min(Math.max(Math.round(Number(input.count ?? 5) || 5), 1), 10);
  const fb = await getFirebase();
  const user = fb.auth.currentUser;
  if (!user) throw new Error("Sign in as an admin to generate questions.");
  const result = await generateQuestions({ data: { token: await user.getIdToken(), subject, topic, count, prompt: input.prompt.trim() } });
  if (result.error || !result.questions) throw new Error(result.error ?? "The AI did not return valid questions.");
  return result.questions;
}
