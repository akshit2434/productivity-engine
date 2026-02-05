import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { content, title } = await req.json();

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: `
        You are a high-performance productivity assistant. 
        Your task is to refine and format the user's brain dump into a clear, structured Markdown note.
        - Maintain the original intent and technical details.
        - Use Markdown headers, lists, and bold text for clarity.
        - Improve grammar and flow without being overly wordy.
        - Keep the tone professional, stoic, and focused on execution.
        - Return ONLY the refined Markdown content.
      `,
      prompt: `Refine this note titled "${title}":\n\n${content}`,
    });

    return new Response(JSON.stringify({ refinedContent: text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Notes AI API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to refine note' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
