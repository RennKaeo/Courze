import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';

const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB

interface WriteArgs {
  filePath: string;
  content: string;
}

export const writeTool: Tool<WriteArgs> = {
  name: 'write',
  description: 'Write content to a file, creating directories if needed. Overwrites existing files.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['filePath', 'content'],
  },

  async handler(args: WriteArgs): Promise<string> {
    const resolvedPath = path.resolve(args.filePath);

    if (args.content.length > MAX_CONTENT_SIZE) {
      return `Error: Content exceeds maximum size of ${MAX_CONTENT_SIZE / (1024 * 1024)}MB (${args.content.length} bytes)`;
    }

    const dir = path.dirname(resolvedPath);
    try {
      await mkdir(dir, { recursive: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error creating directories: ${message}`;
    }

    try {
      await writeFile(resolvedPath, args.content, 'utf-8');
      const lines = args.content.split('\n').length;
      return `Successfully wrote ${args.content.length} bytes (${lines} lines) to ${resolvedPath}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('EACCES') || message.includes('EPERM')) {
        return `Error: Permission denied: ${resolvedPath}`;
      }
      return `Error writing file: ${message}`;
    }
  },
};
