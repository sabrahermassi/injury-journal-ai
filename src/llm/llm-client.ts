import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'openai/gpt-oss-20b';

export async function generateAnswer(
  prompt: string,
  requestId?: string,
): Promise<string> {
  void requestId; // unused for now — reserved for future log correlation (#32)

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
