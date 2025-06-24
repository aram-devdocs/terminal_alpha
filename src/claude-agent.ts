import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { Application, TerminalIO } from "./terminal";
import { Tool, WeatherTool, GitHubRepoTool } from "./tools";

config();

export class ClaudeAgent implements Application {
  private anthropic: Anthropic;
  private tools: Map<string, Tool>;

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("CLAUDE_API_KEY not found in environment variables");
    }

    this.anthropic = new Anthropic({ apiKey });
    
    this.tools = new Map();
    const weatherTool = new WeatherTool();
    this.tools.set(weatherTool.name, weatherTool);
    const githubTool = new GitHubRepoTool();
    this.tools.set(githubTool.name, githubTool);
  }

  async onStart(io: TerminalIO): Promise<void> {
    io.write("Claude Agent with Tools");
    io.write("Available tools: get_weather, read_github_repo");
    io.write("Type '/exit' to quit.");
    io.write("");
  }

  async onInput(input: string, io: TerminalIO): Promise<void> {
    if (input.toLowerCase() === "/exit") {
      io.write("Goodbye!");
      io.exit();
      return;
    }

    try {
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

      const response = await this.anthropic.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 1024,
        messages: [{ role: "user", content: input }],
        tools: tools
      });

      for (const content of response.content) {
        if (content.type === "text") {
          io.write(content.text);
        } else if (content.type === "tool_use") {
          const tool = this.tools.get(content.name);
          if (tool) {
            io.write(`\nUsing tool: ${content.name}`);
            const result = await tool.execute(content.input);
            
            const followUp = await this.anthropic.messages.create({
              model: "claude-3-5-haiku-latest",
              max_tokens: 1024,
              messages: [
                { role: "user", content: input },
                { role: "assistant", content: response.content },
                {
                  role: "user",
                  content: [{
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: JSON.stringify(result.data || { error: result.error })
                  }]
                }
              ],
              tools: tools
            });

            for (const followUpContent of followUp.content) {
              if (followUpContent.type === "text") {
                io.write(followUpContent.text);
              }
            }
          }
        }
      }
    } catch (error) {
      io.write(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
