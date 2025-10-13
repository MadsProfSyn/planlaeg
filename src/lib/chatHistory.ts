export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  lastUpdated: number;
}

const STORAGE_KEY = 'profsyn-ai-sessions';
const MAX_SESSIONS = 5;

/**
 * Get all chat sessions from localStorage
 */
export function getAllSessions(): ChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const sessions = JSON.parse(stored) as ChatSession[];
    return sessions.sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, MAX_SESSIONS);
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
}

/**
 * Save or update a chat session (auto-prunes to keep only 5)
 */
export function saveSession(session: ChatSession): void {
  try {
    let sessions = getAllSessions();
    
    // Update existing or add new
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    
    // Sort by last updated and keep only top 5
    sessions = sessions
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
      .slice(0, MAX_SESSIONS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

/**
 * Delete a specific session
 */
export function deleteSession(id: string): void {
  try {
    const sessions = getAllSessions().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}

/**
 * Generate a title from the first user message (max 40 chars)
 */
export function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim();
  if (cleaned.length <= 40) return cleaned;
  return cleaned.slice(0, 37) + '...';
}

/**
 * Create a new empty session
 */
export function createNewSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: 'Ny samtale',
    messages: [],
    timestamp: Date.now(),
    lastUpdated: Date.now(),
  };
}
