export type LoadingState = 'idle' | 'transcribing' | 'generating';

export interface LogEntry {
  id: string;
  timestamp: string;
  extractedText: string;
  suggestions: string[];
  copiedResponse: string;
}

export type Persona = 'polite' | 'casual' | 'formal' | 'gal' | 'osaka';

export interface Settings {
  minLength: number;
  maxLength: number;
  persona: Persona;
}

export type Tab = 'upload' | 'response' | 'generate' | 'settings';
