import { google } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { text, values } = await req.json();

    if (!text && !values) {
      return new Response(JSON.stringify({ error: 'Text or values array is required' }), { status: 400 });
    }

    const model = google.textEmbeddingModel('text-embedding-004');

    if (text) {
      const { embedding } = await embed({
        model,
        value: text,
      });
      return new Response(JSON.stringify({ embedding }), { status: 200 });
    }

    if (values && Array.isArray(values)) {
      const { embeddings } = await embedMany({
        model,
        values,
      });
      return new Response(JSON.stringify({ embeddings }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  } catch (error: any) {
    console.error('[Embed API] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
