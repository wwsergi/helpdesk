'use client';

import { useChat } from '@ai-sdk/react';
import { Bot, User, Send, Paperclip, X, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    streamProtocol: 'text',
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !files?.length) return;
    handleSubmit(e, { experimental_attachments: files ?? undefined });
    setFiles(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || files?.length) {
        e.currentTarget.form?.requestSubmit();
      }
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

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-brand">
          <Bot size={26} color="#F47B20" />
          <h1>Claud-IA</h1>
        </div>
        <nav className="nav-links">
          <Link href="/" className="nav-link active">Chat</Link>
          <Link href="/settings" className="nav-link">
            <Settings size={14} />
            Settings
          </Link>
        </nav>
      </header>

      <main className="chat-container">
        {messages.length === 0 && (
          <div className="empty-state animate-fade-in">
            <Bot size={52} color="#F47B20" />
            <h2>Welcome to Claud-IA</h2>
            <p>How can I assist you today? You can attach files for context.</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role} animate-fade-in`}>
            <div className="message-icon">
              {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className="message-content">
              <ReactMarkdown>{m.content}</ReactMarkdown>
              {m.experimental_attachments && m.experimental_attachments.length > 0 && (
                <div className="message-attachments">
                  {(m.experimental_attachments as Attachment[]).map((att, i) => (
                    <div key={i} className="attachment-chip attachment-chip--dark">
                      <Paperclip size={11} />
                      {att.name ?? 'Attachment'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message assistant animate-fade-in">
            <div className="message-icon">
              <Bot size={15} />
            </div>
            <div className="message-content">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner animate-fade-in">
            {error.message ?? 'Something went wrong. Please try again.'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <div className="input-container">
        <form onSubmit={onSubmit}>
          {files && files.length > 0 && (
            <div className="attachments-preview animate-fade-in">
              {Array.from(files).map((file, i) => (
                <div key={i} className="attachment-chip">
                  <span className="attachment-name">{file.name}</span>
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={() => removeFile(i)}
                    aria-label="Remove file"
                  >
                    <X size={13} />
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
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              className="text-input"
              value={input}
              onChange={(e) => {
                handleInputChange(e);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Claud-IA… (Enter to send, Shift+Enter for new line)"
              disabled={isLoading}
              rows={1}
            />
            <button
              className="send-btn"
              type="submit"
              disabled={isLoading || (!input.trim() && !files?.length)}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
