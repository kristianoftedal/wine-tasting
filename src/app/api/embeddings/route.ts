import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';

async function generateEmbeddingWithRetry(text: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text.slice(0, 8000)
      });
      return embedding;
    } catch (error) {
      console.error(`[v0] Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const embedding = await generateEmbeddingWithRetry(text);

    return NextResponse.json({ embedding });
  } catch (error) {
    console.error('[v0] Error generating embedding:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate embedding',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
