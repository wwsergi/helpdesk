import { getSettings, saveSettings } from '@/lib/settings';

const ALLOWED_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']);
const MAX_PROMPT_LENGTH = 10_000;
const MAX_CONTEXT_LENGTH = 50_000;

export async function GET() {
  const settings = getSettings();
  // Return file names only (not content) to keep the response lean
  return Response.json({
    ...settings,
    contextFiles: settings.contextFiles.map((f) => f.name),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { systemPrompt, contextText, model } = body;

    if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
      return Response.json({ error: 'Invalid systemPrompt' }, { status: 400 });
    }
    if (contextText !== undefined && typeof contextText !== 'string') {
      return Response.json({ error: 'Invalid contextText' }, { status: 400 });
    }
    if (model !== undefined && !ALLOWED_MODELS.has(model)) {
      return Response.json({ error: 'Invalid model' }, { status: 400 });
    }
    if (systemPrompt && systemPrompt.length > MAX_PROMPT_LENGTH) {
      return Response.json({ error: 'System prompt too long (max 10,000 characters)' }, { status: 400 });
    }
    if (contextText && contextText.length > MAX_CONTEXT_LENGTH) {
      return Response.json({ error: 'Context text too long (max 50,000 characters)' }, { status: 400 });
    }

    const updated = saveSettings({
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(contextText !== undefined && { contextText }),
      ...(model !== undefined && { model }),
    });

    return Response.json({
      ...updated,
      contextFiles: updated.contextFiles.map((f) => f.name),
    });
  } catch (error) {
    console.error('Settings save error:', error instanceof Error ? error.message : 'Unknown');
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
