import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'openai/gpt-oss-20b';

export async function generateAnswer(
  systemPrompt: string,
  userPrompt: string,
  requestId?: string,
): Promise<string> {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
