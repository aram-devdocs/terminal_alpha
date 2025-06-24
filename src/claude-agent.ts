import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { Application, TerminalIO } from "./terminal";
import { Tool, WeatherTool, GitHubRepoTool } from "./tools";
import { ConversationManager, Conversation } from "./conversation-manager";
import { 
  formatMarkdown, 
  formatUserMessage, 
  formatAssistantMessage, 
  formatToolUse, 
  formatError,
  formatHeader,
  formatDivider 
} from "./ui-utils";

config();

type AppState = 'menu' | 'chat' | 'conversations';

export class ClaudeAgent implements Application {
  private anthropic: Anthropic;
  private tools: Map<string, Tool>;
  private conversationManager: ConversationManager;
  private state: AppState = 'menu';
  private io: TerminalIO | null = null;

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("CLAUDE_API_KEY not found in environment variables");
    }

    this.anthropic = new Anthropic({ apiKey });
    this.conversationManager = new ConversationManager();
    
    this.tools = new Map();
    const weatherTool = new WeatherTool();
    this.tools.set(weatherTool.name, weatherTool);
    const githubTool = new GitHubRepoTool();
    this.tools.set(githubTool.name, githubTool);
  }

  async onStart(io: TerminalIO): Promise<void> {
    this.io = io;
    this.showMenu();
  }

  private showMenu(): void {
    if (!this.io) return;
    
    this.io.clear();
    this.io.write(formatHeader("Claude Agent Terminal Chat"));
    this.io.write("");
    this.io.write("1. New Conversation");
    this.io.write("2. Continue Conversation");
    this.io.write("3. View All Conversations");
    this.io.write("4. Exit");
    this.io.write("");
    this.io.write("Select an option (1-4):");
    this.state = 'menu';
  }

  private showConversationsList(): void {
    if (!this.io) return;
    
    this.io.clear();
    this.io.write(formatHeader("All Conversations"));
    this.io.write("");
    
    const conversations = this.conversationManager.getAllConversations();
    
    if (conversations.length === 0) {
      this.io.write("No conversations yet.");
    } else {
      conversations.forEach((conv, index) => {
        this.io!.write(`${index + 1}. ${conv.title} (${conv.messages.length} messages)`);
        this.io!.write(`   Created: ${conv.createdAt.toLocaleString()}`);
        this.io!.write("");
      });
    }
    
    this.io.write("");
    this.io.write("Commands:");
    this.io.write("- Enter number to select conversation");
    this.io.write("- 'd <number>' to delete conversation");
    this.io.write("- 'back' to return to menu");
    this.state = 'conversations';
  }

  private startChat(conversation?: Conversation): void {
    if (!this.io) return;
    
    if (!conversation) {
      conversation = this.conversationManager.createConversation();
    }
    
    this.io.clear();
    this.io.write(formatHeader(conversation.title));
    this.io.write("");
    this.io.write("Available tools: get_weather, read_github_repo");
    this.io.write("Commands: /menu, /clear, /exit");
    this.io.write(formatDivider());
    
    // Display existing messages
    conversation.messages.forEach(msg => {
      if (msg.role === 'user') {
        this.io!.write(formatUserMessage(msg.content));
      } else {
        this.io!.write(formatAssistantMessage(msg.content));
      }
      this.io!.write("");
    });
    
    this.state = 'chat';
  }

  async onInput(input: string): Promise<void> {
    switch (this.state) {
      case 'menu':
        await this.handleMenuInput(input);
        break;
      case 'chat':
        await this.handleChatInput(input);
        break;
      case 'conversations':
        await this.handleConversationsInput(input);
        break;
    }
  }

  private async handleMenuInput(input: string): Promise<void> {
    switch (input.trim()) {
      case '1':
        this.startChat();
        break;
      case '2':
        this.showConversationsList();
        break;
      case '3':
        this.showConversationsList();
        break;
      case '4':
        this.io?.write("Goodbye!");
        this.io?.exit();
        break;
      default:
        this.io?.write("Invalid option. Please select 1-4.");
    }
  }

  private async handleConversationsInput(input: string): Promise<void> {
    if (input.toLowerCase() === 'back') {
      this.showMenu();
      return;
    }

    if (input.startsWith('d ')) {
      const index = parseInt(input.substring(2)) - 1;
      const conversations = this.conversationManager.getAllConversations();
      if (index >= 0 && index < conversations.length) {
        this.conversationManager.deleteConversation(conversations[index].id);
        this.showConversationsList();
      }
      return;
    }

    const index = parseInt(input) - 1;
    const conversations = this.conversationManager.getAllConversations();
    if (index >= 0 && index < conversations.length) {
      this.conversationManager.setCurrentConversation(conversations[index].id);
      this.startChat(conversations[index]);
    }
  }

  private async handleChatInput(input: string): Promise<void> {
    if (input.toLowerCase() === "/menu") {
      this.showMenu();
      return;
    }

    if (input.toLowerCase() === "/clear") {
      this.conversationManager.clearCurrentConversation();
      this.startChat(this.conversationManager.getCurrentConversation());
      return;
    }

    if (input.toLowerCase() === "/exit") {
      this.io?.write("Goodbye!");
      this.io?.exit();
      return;
    }

    // Add user message
    this.conversationManager.addMessage('user', input);
    this.io?.write(formatUserMessage(input));
    this.io?.write("");

    try {
      const conversation = this.conversationManager.getCurrentConversation();
      if (!conversation) return;

      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.name === "get_weather" ? {
          type: "object" as const,
          properties: {
            location: {
              type: "string" as const,
              description: "The city and state, e.g., San Francisco, CA"
            }
          },
          required: ["location"]
        } : {
          type: "object" as const,
          properties: {
            repoUrl: {
              type: "string" as const,
              description: "The GitHub repository URL"
            },
            branch: {
              type: "string" as const,
              description: "The branch to read (optional, defaults to main)"
            }
          },
          required: ["repoUrl"]
        }
      }));

      // Build messages history
      const messages = conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const stopLoading = this.io!.startLoading('Claude is thinking');
      
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 1024,
        messages: messages,
        tools: tools,
        stream: true
      });
      
      stopLoading();

      let fullResponse = "";
      let toolCalls: any[] = [];
      let currentText = "";
      let isFirstChunk = true;
      let currentToolCall: any = null;
      let toolInputJson = "";
      
      for await (const chunk of response) {
        if (chunk.type === 'message_start') {
          if (isFirstChunk) {
            this.io?.writeRaw("Claude: ");
            isFirstChunk = false;
          }
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            if (currentText) {
              fullResponse += currentText;
              currentText = "";
            }
            this.io?.write("");
            this.io?.write(formatToolUse(chunk.content_block.name));
            currentToolCall = {
              id: chunk.content_block.id,
              name: chunk.content_block.name,
              type: 'tool_use'
            };
            toolInputJson = "";
          }
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            currentText += chunk.delta.text;
            this.io?.writeStream(chunk.delta.text);
          } else if (chunk.delta.type === 'input_json_delta') {
            toolInputJson += chunk.delta.partial_json;
          }
        } else if (chunk.type === 'content_block_stop') {
          if (currentToolCall && toolInputJson) {
            currentToolCall.input = JSON.parse(toolInputJson);
            toolCalls.push(currentToolCall);
            currentToolCall = null;
            toolInputJson = "";
          }
        }
      }
      
      if (currentText) {
        fullResponse += currentText;
      }
      
      this.io?.write("");
      
      // Handle tool calls
      for (const toolCall of toolCalls) {
        const tool = this.tools.get(toolCall.name);
        if (tool) {
          const stopToolLoading = this.io!.startLoading(`Running ${toolCall.name}`);
          const result = await tool.execute(toolCall.input);
          stopToolLoading();
          
          const followUpStream = await this.anthropic.messages.create({
            model: "claude-3-5-haiku-latest",
            max_tokens: 1024,
            messages: [
              ...messages,
              { role: "assistant", content: [{type: "text", text: fullResponse}, ...toolCalls] },
              {
                role: "user",
                content: [{
                  type: "tool_result",
                  tool_use_id: toolCall.id,
                  content: JSON.stringify(result.data || { error: result.error })
                }]
              }
            ],
            tools: tools,
            stream: true
          });
          
          this.io?.write("");
          let toolResponseText = "";
          for await (const chunk of followUpStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              toolResponseText += chunk.delta.text;
              this.io?.writeStream(chunk.delta.text);
            }
          }
          
          fullResponse += "\n" + toolResponseText;
        }
      }
      
      this.conversationManager.addMessage('assistant', fullResponse);
      this.io?.write("");
      this.io?.write("");
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.io?.write(formatError(errorMsg));
      this.io?.write("");
    }
  }
}