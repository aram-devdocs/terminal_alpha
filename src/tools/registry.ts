import { BaseTool } from './base';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getSchemas(): any[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.getSchema() as any,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }
}
