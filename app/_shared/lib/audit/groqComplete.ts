// app/_shared/lib/audit/groqComplete.ts

// The Groq call every AI report is written with: one prompt in, the model's JSON
// reply out. Server-only.

import Groq from 'groq-sdk';

export function groqComplete(apiKey: string): (prompt: string) => Promise<string> {
  const groq = new Groq({ apiKey });
  return async (prompt) => {
    const completion = await groq.chat.completions.create({
      // llama-3.3-70b-versatile is no longer served by Groq (model_not_found)
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      // gpt-oss reasons before answering and those tokens count against
      // max_tokens: at default effort it used up to ~1.5k and got cut off
      // mid-JSON (json_validate_failed). Low effort uses ~50; 4096 is headroom.
      reasoning_effort: 'low',
      max_tokens: 4096,
    });
    return completion.choices[0]?.message?.content ?? '{}';
  };
}
