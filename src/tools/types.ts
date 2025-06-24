export interface Tool {
  name: string;
  description: string;
  execute(params: unknown): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
