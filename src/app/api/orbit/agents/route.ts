import { NextResponse } from 'next/server';
import { createAgent, createAssistantFromScratch } from '@/lib/services/orbit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Create from scratch when assistantId is not provided
    if (!body.assistantId && body.name && (body.systemPrompt ?? body.firstMessage)) {
      const result = await createAssistantFromScratch({
        name: body.name,
        firstMessage: body.firstMessage || '',
        systemPrompt: body.systemPrompt || 'You are a helpful AI assistant.',
        language: body.language,
      });
      return NextResponse.json(result);
    }
    // Clone from existing assistant
    const result = await createAgent(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
