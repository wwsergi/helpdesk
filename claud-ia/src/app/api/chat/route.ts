import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
import { saveMessages } from '@/lib/conversations';

export const maxDuration = 30;

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 100;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
]);

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Server misconfiguration: missing API key' }, { status: 500 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Please wait before sending more messages.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const { messages, sessionId, customerIdentifier, identifierType } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    if (messages.length > MAX_MESSAGES) {
      return Response.json({ error: 'Conversation too long' }, { status: 400 });
    }

    const last = messages[messages.length - 1];
    if (typeof last?.content === 'string' && last.content.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ error: 'Message too long (max 4000 characters)' }, { status: 400 });
    }

    for (const msg of messages) {
      if (msg.experimental_attachments) {
        for (const att of msg.experimental_attachments) {
          if (att.contentType && !ALLOWED_MIME_TYPES.has(att.contentType)) {
            return Response.json(
              { error: `File type not allowed: ${att.contentType}` },
              { status: 400 },
            );
          }
        }
      }
    }

    const settings = getSettings();

    let systemPrompt = settings.systemPrompt;
    if (settings.contextText.trim()) {
      systemPrompt += `\n\n## Knowledge Base\n${settings.contextText}`;
    }
    if (settings.contextFiles.length > 0) {
      systemPrompt += '\n\n## Context Documents\n';
      for (const file of settings.contextFiles) {
        systemPrompt += `\n### ${file.name}\n${file.content}\n`;
      }
    }

    const result = streamText({
      model: openai(settings.model),
      messages,
      system: systemPrompt,
      onFinish: async ({ text }) => {
        if (!sessionId || !customerIdentifier || !process.env.MONGODB_URI) return;
        const lastUser = messages[messages.length - 1];
        const userContent = typeof lastUser?.content === 'string' ? lastUser.content : '';
        try {
          await saveMessages(sessionId, customerIdentifier, identifierType ?? 'email', [
            { role: 'user', content: userContent, timestamp: new Date() },
            { role: 'assistant', content: text, timestamp: new Date() },
          ]);
        } catch (e) {
          console.error('Failed to save conversation:', e);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
