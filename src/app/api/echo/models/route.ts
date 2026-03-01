import { NextResponse } from 'next/server';
import { fetchModels } from '@/lib/services/echo';

export async function GET() {
  try {
    const models = await fetchModels();
    return NextResponse.json(models);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
