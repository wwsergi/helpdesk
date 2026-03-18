import fs from 'fs';
import path from 'path';

export interface ChatSettings {
  systemPrompt: string;
  contextText: string;
  model: string;
  contextFiles: Array<{ name: string; content: string }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_SETTINGS: ChatSettings = {
  systemPrompt:
    'You are Claud-IA, a premium, intelligent AI assistant. Always be helpful, engaging, and format your responses elegantly using markdown. You can read user-provided context or files if they send them.',
  contextText: '',
  model: 'gpt-4o-mini',
  contextFiles: [],
};

export function getSettings(): ChatSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS, contextFiles: [] };
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS, contextFiles: [] };
  }
}

export function saveSettings(updates: Partial<ChatSettings>): ChatSettings {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const current = getSettings();
  const updated = { ...current, ...updates };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
