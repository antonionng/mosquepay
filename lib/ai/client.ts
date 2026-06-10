/**
 * Thin wrapper for AI completions used by the operations assistant.
 *
 * If OPENAI_API_KEY is set we hit the OpenAI Chat Completions API directly.
 * Otherwise we return null so callers can fall back to deterministic logic.
 *
 * This stays consistent with the existing AI draft route in
 * app/api/churches/[slug]/ai-draft/route.ts and keeps us independent of any
 * specific AI SDK package.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function completeJSON<T>({
  system,
  user,
  model,
  temperature,
}: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? "gpt-4o-mini",
        temperature: temperature ?? 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const completion = await res.json();
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function completeText({
  system,
  user,
  model,
  temperature,
}: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? "gpt-4o-mini",
        temperature: temperature ?? 0.5,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const completion = await res.json();
    const content = completion?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
