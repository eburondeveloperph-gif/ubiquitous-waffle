import { NextResponse } from 'next/server';
import { createOutboundCall } from '@/lib/services/orbit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { assistantId, customerNumber } = body;
    if (!assistantId || !customerNumber) {
      return NextResponse.json(
        { error: 'assistantId and customerNumber are required' },
        { status: 400 }
      );
    }
    const result = await createOutboundCall({ assistantId, customerNumber });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
