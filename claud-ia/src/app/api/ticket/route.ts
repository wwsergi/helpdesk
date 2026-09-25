import { getConversation, markTicketCreated } from '@/lib/conversations';

export async function POST(req: Request) {
  if (!process.env.MONGODB_URI) {
    return Response.json({ error: 'MongoDB not configured' }, { status: 500 });
  }
  if (!process.env.CLAUDIA_WEBHOOK_SECRET || !process.env.HELPDESK_API_URL) {
    return Response.json({ error: 'Ticket integration not configured' }, { status: 500 });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: 'Missing sessionId' }, { status: 400 });

    const conv = await getConversation(sessionId);
    if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 });

    // Already created
    if (conv.ticketId) return Response.json({ uuid: conv.ticketId });

    if (conv.messages.length === 0) {
      return Response.json({ error: 'No messages in conversation' }, { status: 400 });
    }

    // Build conversation transcript
    const transcript = conv.messages
      .map((m) => `${m.role === 'user' ? `**${conv.customerIdentifier}**` : '**Claud-IA**'}: ${m.content}`)
      .join('\n\n');

    const description = `**Chatbot conversation with ${conv.customerIdentifier}**\n\n---\n\n${transcript}`;

    const res = await fetch(`${process.env.HELPDESK_API_URL}/external/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Claudia-Key': process.env.CLAUDIA_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        customer_identifier: conv.customerIdentifier,
        identifier_type: conv.identifierType,
        description,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('HelpDesk ticket creation failed:', err);
      return Response.json({ error: 'Failed to create ticket in HelpDesk' }, { status: 502 });
    }

    const data = await res.json();
    await markTicketCreated(sessionId, data.uuid);
    return Response.json({ uuid: data.uuid }, { status: 201 });
  } catch (error) {
    console.error('Ticket route error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
