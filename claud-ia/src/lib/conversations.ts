import { getDb } from './mongodb';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  sessionId: string;
  customerIdentifier: string;
  identifierType: 'email' | 'id';
  messages: ConversationMessage[];
  ticketId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'conversations';

export async function saveMessages(
  sessionId: string,
  customerIdentifier: string,
  identifierType: 'email' | 'id',
  newMessages: ConversationMessage[],
): Promise<void> {
  const db = await getDb();
  await db.collection<Conversation>(COLLECTION).updateOne(
    { sessionId },
    {
      $setOnInsert: {
        sessionId,
        customerIdentifier,
        identifierType,
        ticketId: null,
        createdAt: new Date(),
      },
      $push: { messages: { $each: newMessages } },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

export async function getConversation(sessionId: string): Promise<Conversation | null> {
  const db = await getDb();
  return db.collection<Conversation>(COLLECTION).findOne({ sessionId }) as Promise<Conversation | null>;
}

export async function markTicketCreated(sessionId: string, ticketId: string): Promise<void> {
  const db = await getDb();
  await db.collection<Conversation>(COLLECTION).updateOne(
    { sessionId },
    { $set: { ticketId, updatedAt: new Date() } },
  );
}
