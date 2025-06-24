export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description?: string;
      enum?: readonly unknown[];
      items?: ToolInputSchema;
    }
  >;
  required?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}
