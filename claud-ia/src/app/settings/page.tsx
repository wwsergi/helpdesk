'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Save, Upload, X, Check, Settings, FileText, FileType, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SettingsState {
  systemPrompt: string;
  contextText: string;
  model: string;
  contextFiles: string[];
}

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini — Fast & affordable' },
  { value: 'gpt-4o', label: 'GPT-4o — Most capable' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo — Balanced' },
];

const DEFAULT_STATE: SettingsState = {
  systemPrompt: '',
  contextText: '',
  model: 'gpt-4o-mini',
  contextFiles: [],
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          systemPrompt: data.systemPrompt ?? '',
          contextText: data.contextText ?? '',
          model: data.model ?? 'gpt-4o-mini',
          contextFiles: data.contextFiles ?? [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: settings.systemPrompt,
          contextText: settings.contextText,
          model: settings.model,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? 'Failed to save');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/api/settings/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? 'Upload failed');
      } else {
        setSettings((s) => ({ ...s, contextFiles: data.files }));
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await fetch(`${BASE}/api/auth`, { method: 'DELETE' });
    router.push('/login');
  };

  const handleDeleteFile = async (name: string) => {
    try {
      const res = await fetch(`${BASE}/api/settings/upload`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings((s) => ({ ...s, contextFiles: data.files }));
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <Bot size={40} color="#F47B20" />
          <p>Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-brand">
          <Bot size={26} color="#F47B20" />
          <h1>Claud-IA</h1>
        </div>
        <nav className="nav-links">
          <Link href="/" className="nav-link">Chat</Link>
          <Link href="/settings" className="nav-link active">
            <Settings size={14} />
            Settings
          </Link>
          <button className="logout-btn" onClick={handleLogout} aria-label="Log out">
            <LogOut size={14} />
            Log out
          </button>
        </nav>
      </header>

      <main className="settings-container">
        <div className="settings-header">
          <h2>Bot Configuration</h2>
          <p>Customize how Claud-IA behaves and what it knows.</p>
        </div>

        {/* Model */}
        <section className="settings-card">
          <h3 className="settings-card-title">AI Model</h3>
          <div className="settings-field">
            <label htmlFor="model-select">Model</label>
            <select
              id="model-select"
              className="settings-select"
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* System Prompt */}
        <section className="settings-card">
          <h3 className="settings-card-title">System Prompt</h3>
          <p className="settings-card-desc">
            Define the assistant persona, tone, and any standing instructions.
          </p>
          <div className="settings-field">
            <label htmlFor="system-prompt">Prompt</label>
            <textarea
              id="system-prompt"
              className="settings-textarea"
              rows={6}
              value={settings.systemPrompt}
              onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
              placeholder="You are a helpful assistant…"
              maxLength={10000}
            />
            <span className="char-count">{settings.systemPrompt.length} / 10,000</span>
          </div>
        </section>

        {/* Knowledge Base */}
        <section className="settings-card">
          <h3 className="settings-card-title">Knowledge Base</h3>
          <p className="settings-card-desc">
            Paste FAQs, product information, or any text the bot should always have access to.
          </p>
          <div className="settings-field">
            <label htmlFor="context-text">Context</label>
            <textarea
              id="context-text"
              className="settings-textarea"
              rows={10}
              value={settings.contextText}
              onChange={(e) => setSettings((s) => ({ ...s, contextText: e.target.value }))}
              placeholder="Product name: …&#10;FAQ: …&#10;Contact: …"
              maxLength={50000}
            />
            <span className="char-count">{settings.contextText.length} / 50,000</span>
          </div>
        </section>

        {/* Context Files */}
        <section className="settings-card">
          <h3 className="settings-card-title">Context Files</h3>
          <p className="settings-card-desc">
            Upload .txt, .md, .csv, or .pdf files (max 10 MB each, up to 10 files). Text is extracted
            and injected as context into every conversation. PDFs must be text-based (not scanned images).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.pdf"
            className="file-input-hidden"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={16} />
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>

          {uploadError && <p className="settings-error">{uploadError}</p>}

          {settings.contextFiles.length > 0 && (
            <ul className="file-list">
              {settings.contextFiles.map((name) => (
                <li key={name} className="file-list-item">
                  {name.toLowerCase().endsWith('.pdf') ? <FileType size={15} /> : <FileText size={15} />}
                  <span>{name}</span>
                  <button
                    type="button"
                    className="file-delete-btn"
                    onClick={() => handleDeleteFile(name)}
                    aria-label={`Remove ${name}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Save */}
        <div className="settings-actions">
          {saveError && <p className="settings-error">{saveError}</p>}
          <button
            type="button"
            className={`save-btn ${saved ? 'save-btn--success' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? (
              <>
                <Check size={16} />
                Saved!
              </>
            ) : (
              <>
                <Save size={16} />
                {saving ? 'Saving…' : 'Save settings'}
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
