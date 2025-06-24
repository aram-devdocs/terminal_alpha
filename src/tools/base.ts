import { ToolResult, ToolInputSchema } from '../types';

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: ToolInputSchema;

  abstract execute(params: unknown): Promise<ToolResult>;

  protected validateInput(params: unknown): void {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid input: params must be an object');
    }

    const requiredFields = this.inputSchema.required ?? [];
    const paramObj = params as Record<string, unknown>;

    for (const field of requiredFields) {
      if (!(field in paramObj)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  getSchema(): ToolInputSchema {
    return this.inputSchema;
  }
}
