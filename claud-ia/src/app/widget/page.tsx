'use client';

import { useChat } from '@ai-sdk/react';
import { Bot, User, Send, Paperclip, X, Minus, Ticket, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';

type Attachment = { name?: string; contentType?: string; url: string };
type Screen = 'identify' | 'chat' | 'ticket-created';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Widget() {
  const [screen, setScreen] = useState<Screen>('identify');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'id'>('email');
  const [sessionId, setSessionId] = useState<string>('');
  const [ticketUuid, setTicketUuid] = useState<string | null>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    streamProtocol: 'text',
    api: `${BASE}/api/chat`,
    body: { sessionId, customerIdentifier: identifier, identifierType },
  });

  const [files, setFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !files?.length) return;
    handleSubmit(e, { experimental_attachments: files ?? undefined });
    setFiles(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || files?.length) e.currentTarget.form?.requestSubmit();
    }
  };

  const removeFile = (index: number) => {
    if (!files) return;
    const dt = new DataTransfer();
    for (let i = 0; i < files.length; i++) {
      if (i !== index) dt.items.add(files[i]);
    }
    setFiles(dt.files.length > 0 ? dt.files : null);
  };

  const closeWidget = () => {
    window.parent.postMessage('claud-ia:close', '*');
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setSessionId(crypto.randomUUID());
    setScreen('chat');
  };

  const handleCreateTicket = async () => {
    setCreatingTicket(true);
    setTicketError(null);
    try {
      const res = await fetch(`${BASE}/api/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTicketUuid(data.uuid);
        setScreen('ticket-created');
      } else {
        setTicketError('Could not create ticket. Please try again.');
      }
    } catch {
      setTicketError('Network error. Please try again.');
    } finally {
      setCreatingTicket(false);
    }
  };

  return (
    <div className="widget-app">
      <header className="widget-header">
        <div className="header-brand">
          <Bot size={22} color="#F47B20" />
          <span className="widget-title">Claud-IA</span>
        </div>
        <button className="widget-close-btn" onClick={closeWidget} aria-label="Close chat">
          <Minus size={18} />
        </button>
      </header>

      {/* ── Identification screen ── */}
      {screen === 'identify' && (
        <main className="widget-identify animate-fade-in">
          <Bot size={44} color="#F47B20" />
          <p className="identify-title">Hi! Before we start,<br />please identify yourself.</p>
          <form onSubmit={handleStartChat} className="identify-form">
            <div className="identify-type-toggle">
              <button
                type="button"
                className={`type-btn ${identifierType === 'email' ? 'active' : ''}`}
                onClick={() => setIdentifierType('email')}
              >Email</button>
              <button
                type="button"
                className={`type-btn ${identifierType === 'id' ? 'active' : ''}`}
                onClick={() => setIdentifierType('id')}
              >Customer ID</button>
            </div>
            <input
              className="identify-input"
              type={identifierType === 'email' ? 'email' : 'text'}
              placeholder={identifierType === 'email' ? 'your@email.com' : 'External ID'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
            <button type="submit" className="identify-btn" disabled={!identifier.trim()}>
              Start Chat
            </button>
          </form>
        </main>
      )}

      {/* ── Chat screen ── */}
      {screen === 'chat' && (
        <>
          <main className="widget-chat">
            {messages.length === 0 && (
              <div className="widget-empty animate-fade-in">
                <Bot size={40} color="#F47B20" />
                <p>Hi! How can I help you today?</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`w-message ${m.role} animate-fade-in`}>
                <div className="w-message-icon">
                  {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div className="w-message-content">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                  {m.experimental_attachments && m.experimental_attachments.length > 0 && (
                    <div className="message-attachments">
                      {(m.experimental_attachments as Attachment[]).map((att, i) => (
                        <div key={i} className="attachment-chip attachment-chip--dark">
                          <Paperclip size={10} />
                          {att.name ?? 'Attachment'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="w-message assistant animate-fade-in">
                <div className="w-message-icon"><Bot size={13} /></div>
                <div className="w-message-content">
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              </div>
            )}

            {error && (
              <div className="error-banner animate-fade-in">
                {error.message ?? 'Something went wrong.'}
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* ── Ticket bar (shows after at least one exchange) ── */}
          {messages.length >= 2 && (
            <div className="widget-ticket-bar animate-fade-in">
              {ticketError && <p className="ticket-error">{ticketError}</p>}
              <button
                className="create-ticket-btn"
                onClick={handleCreateTicket}
                disabled={creatingTicket}
              >
                <Ticket size={14} />
                {creatingTicket ? 'Creating…' : 'Create Support Ticket'}
              </button>
            </div>
          )}

          <div className="widget-input-area">
            <form onSubmit={onSubmit}>
              {files && files.length > 0 && (
                <div className="attachments-preview animate-fade-in">
                  {Array.from(files).map((file, i) => (
                    <div key={i} className="attachment-chip">
                      <span className="attachment-name">{file.name}</span>
                      <button type="button" className="attachment-remove" onClick={() => removeFile(i)}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="input-form">
                <input
                  type="file"
                  className="file-input-hidden"
                  ref={fileInputRef}
                  onChange={(e) => setFiles(e.target.files)}
                  accept="image/*,.txt"
                  multiple
                />
                <button
                  type="button"
                  className="file-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip size={16} />
                </button>
                <textarea
                  ref={textareaRef}
                  className="text-input"
                  value={input}
                  onChange={(e) => { handleInputChange(e); adjustHeight(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  className="send-btn"
                  type="submit"
                  disabled={isLoading || (!input.trim() && !files?.length)}
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Ticket created screen ── */}
      {screen === 'ticket-created' && (
        <main className="widget-ticket-success animate-fade-in">
          <CheckCircle size={52} color="#22c55e" />
          <p className="ticket-success-title">Ticket Created!</p>
          {ticketUuid && <p className="ticket-success-id">{ticketUuid}</p>}
          <p className="ticket-success-sub">An agent will follow up with you shortly.</p>
          <button className="identify-btn" onClick={closeWidget}>Close</button>
        </main>
      )}
    </div>
  );
}
