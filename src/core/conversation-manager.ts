export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private currentConversationId: string | null = null;

  createConversation(title?: string): Conversation {
    const id = Date.now().toString();
    const conversation: Conversation = {
      id,
      title: title || `Chat ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(id, conversation);
    this.currentConversationId = id;
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  getCurrentConversation(): Conversation | undefined {
    if (!this.currentConversationId) return undefined;
    return this.conversations.get(this.currentConversationId);
  }

  setCurrentConversation(id: string): boolean {
    if (this.conversations.has(id)) {
      this.currentConversationId = id;
      return true;
    }
    return false;
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  deleteConversation(id: string): boolean {
    if (this.currentConversationId === id) {
      this.currentConversationId = null;
    }
    return this.conversations.delete(id);
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    const conversation = this.getCurrentConversation();
    if (!conversation) return;

    conversation.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    conversation.updatedAt = new Date();
  }

  clearCurrentConversation(): void {
    const conversation = this.getCurrentConversation();
    if (!conversation) return;

    conversation.messages = [];
    conversation.updatedAt = new Date();
  }
}
