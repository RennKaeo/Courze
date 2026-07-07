import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { Tool } from '../types.js';
import { validatePath } from '../../utils/helpers.js';

const MAX_LINES = 2000;

interface ReadArgs {
  filePath: string;
  offset?: number;
  limit?: number;
}

export const readTool: Tool<ReadArgs> = {
  name: 'read',
  description: 'Read the contents of a file with line numbers. Returns up to 2000 lines.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to return',
      },
    },
    required: ['filePath'],
  },

  async handler(args: ReadArgs): Promise<string> {
    let resolvedPath: string;
    try {
      resolvedPath = validatePath(args.filePath);
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }

    try {
      await access(resolvedPath, constants.R_OK);
    } catch {
      return `Error: File not found or not readable: ${resolvedPath}`;
    }

    let content: string;
    try {
      content = await readFile(resolvedPath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('EACCES') || message.includes('EPERM')) {
        return `Error: Permission denied: ${resolvedPath}`;
      }
      return `Error reading file: ${message}`;
    }

    const lines = content.split('\n');
    const totalLines = lines.length;

    const startLine = args.offset ? Math.max(1, args.offset) : 1;
    const maxLines = args.limit ?? MAX_LINES;
    const endLine = Math.min(startLine + maxLines - 1, totalLines);

    const displayedLines = lines.slice(startLine - 1, endLine);

    const resultLines = displayedLines.map((line, i) => {
      const lineNum = startLine + i;
      return `${lineNum}: ${line}`;
    });

    let result = resultLines.join('\n');

    if (endLine < totalLines) {
      result += `\n... (${totalLines - endLine} more lines)`;
    }

    result += `\n\n(File: ${resolvedPath}, ${totalLines} lines total, showing ${startLine}-${endLine})`;

    return result;
  },
};
