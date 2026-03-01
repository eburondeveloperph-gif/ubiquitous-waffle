import { NextResponse } from 'next/server';
import { uploadFile } from '@/lib/services/orbit';

const ACCEPTED_TYPES = [
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/markdown',
  'text/tab-separated-values',
  'application/x-yaml',
  'application/json',
  'application/xml',
  'text/x-log',
];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file?.size) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > 300 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Keep files under 300KB for best performance.' },
        { status: 400 }
      );
    }
    const type = file.type || '';
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['txt', 'pdf', 'docx', 'doc', 'csv', 'md', 'tsv', 'yaml', 'yml', 'json', 'xml', 'log'];
    const isAllowedType = ACCEPTED_TYPES.includes(type) || allowedExts.includes(ext);
    if (!isAllowedType) {
      return NextResponse.json(
        { error: `Unsupported format. Use: ${allowedExts.join(', ')}` },
        { status: 400 }
      );
    }
    const result = await uploadFile(file, file.name);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
