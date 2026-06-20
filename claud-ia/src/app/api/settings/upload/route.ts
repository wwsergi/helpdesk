import { getSettings, saveSettings } from '@/lib/settings';
// Import from the implementation file directly to avoid the top-level
// debug block in pdf-parse/index.js that references a test PDF path,
// which confuses Next.js/Turbopack's static bundler analysis.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.pdf']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (PDFs can be larger)
const MAX_FILES = 10;

async function extractText(file: File): Promise<string> {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();

  if (ext === '.pdf') {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    const text = result.text.trim();
    if (!text) throw new Error('Could not extract text from PDF. The file may be image-based or protected.');
    return text;
  }

  return file.text();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return Response.json(
        { error: 'File type not allowed. Supported: .txt, .md, .csv, .pdf' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
    }

    const settings = getSettings();

    if (
      settings.contextFiles.length >= MAX_FILES &&
      !settings.contextFiles.some((f) => f.name === file.name)
    ) {
      return Response.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    const content = await extractText(file);
    const existing = settings.contextFiles.filter((f) => f.name !== file.name);
    const updated = saveSettings({ contextFiles: [...existing, { name: file.name, content }] });

    return Response.json({ success: true, files: updated.contextFiles.map((f) => f.name) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('Upload error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { name } = await req.json();
    if (typeof name !== 'string') {
      return Response.json({ error: 'Invalid file name' }, { status: 400 });
    }

    const settings = getSettings();
    const updated = saveSettings({
      contextFiles: settings.contextFiles.filter((f) => f.name !== name),
    });

    return Response.json({ success: true, files: updated.contextFiles.map((f) => f.name) });
  } catch (error) {
    console.error('Delete error:', error instanceof Error ? error.message : 'Unknown');
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}
