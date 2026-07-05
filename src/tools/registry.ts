import type { Tool } from './types.js';
import { readTool } from './file/read.js';
import { writeTool } from './file/write.js';
import { editTool } from './file/edit.js';
import { globTool } from './file/glob.js';
import { bashTool } from './shell/bash.js';
import { grepTool } from './search/grep.js';
import { webFetchTool } from './search/web.js';

export type { Tool };
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.register(readTool);
    this.register(writeTool);
    this.register(editTool);
    this.register(globTool);
    this.register(bashTool);
    this.register(grepTool);
    this.register(webFetchTool);
  }

  register(tool: Tool<any>): void {
    this.tools.set(tool.name, tool as Tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}
