/**
 * Conversation Store - Voice interaction and chat history
 */
import { create } from 'zustand';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  // Biometric snapshot at time of message
  biometricSnapshot?: {
    hrvMs: number;
    bpm: number;
    stressScore: number;
  };
  // Audio data (for voice playback)
  audioUrl?: string;
}

interface ConversationState {
  // Messages
  messages: Message[];
  
  // Voice state
  isRecording: boolean;
  isTranscribing: boolean;
  isGenerating: boolean;
  isSpeaking: boolean;
  
  // Current transcription (while recording)
  currentTranscription: string;
  
  // Error handling
  error: string | null;
  
  // Actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  setRecording: (recording: boolean) => void;
  setTranscribing: (transcribing: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setCurrentTranscription: (text: string) => void;
  setError: (error: string | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useConversationStore = create<ConversationState>((set, get) => ({
  messages: [],
  isRecording: false,
  isTranscribing: false,
  isGenerating: false,
  isSpeaking: false,
  currentTranscription: '',
  error: null,

  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  },

  clearMessages: () => set({ messages: [] }),

  setRecording: (recording) => set({ isRecording: recording }),
  
  setTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
  
  setGenerating: (generating) => set({ isGenerating: generating }),
  
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  
  setCurrentTranscription: (text) => set({ currentTranscription: text }),
  
  setError: (error) => set({ error }),
}));
