import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';

interface EditArgs {
  filePath: string;
  oldString: string;
  newString: string;
  insertLine?: number;
}

export const editTool: Tool<EditArgs> = {
  name: 'edit',
  description: 'Edit a file by performing an exact string replacement or inserting at a specific line. Returns a diff-like summary.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to edit',
      },
      oldString: {
        type: 'string',
        description: 'Text to search for and replace. Leave empty when using insertLine.',
      },
      newString: {
        type: 'string',
        description: 'Text to replace with or insert',
      },
      insertLine: {
        type: 'number',
        description: 'Line number (1-indexed) to insert newString at. Used when oldString is empty.',
      },
    },
    required: ['filePath', 'newString'],
  },

  async handler(args: EditArgs): Promise<string> {
    const resolvedPath = path.resolve(args.filePath);

    let content: string;
    try {
      content = await readFile(resolvedPath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error reading file: ${message}`;
    }

    // Insert mode
    if (!args.oldString && args.insertLine !== undefined) {
      const lines = content.split('\n');
      const insertAt = Math.max(1, Math.min(args.insertLine, lines.length + 1));
      lines.splice(insertAt - 1, 0, args.newString);
      const newContent = lines.join('\n');

      try {
        await writeFile(resolvedPath, newContent, 'utf-8');
        const addedLines = args.newString.split('\n').length;
        return `Inserted ${addedLines} line(s) at line ${insertAt} in ${resolvedPath}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error writing file: ${message}`;
      }
    }

    // Replace mode
    if (!args.oldString) {
      return 'Error: Either oldString or insertLine must be provided';
    }

    const occurrences = content.split(args.oldString).length - 1;

    if (occurrences === 0) {
      return `Error: Could not find exact match for oldString in ${resolvedPath}`;
    }

    if (occurrences > 1) {
      return `Error: Found ${occurrences} occurrences of oldString in ${resolvedPath}. Provide more surrounding context to identify the correct match.`;
    }

    const beforeLines = content.substring(0, content.indexOf(args.oldString)).split('\n');
    const matchLine = beforeLines.length;

    const newContent = content.replace(args.oldString, args.newString);

    try {
      await writeFile(resolvedPath, newContent, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error writing file: ${message}`;
    }

    const oldLines = args.oldString.split('\n').length;
    const newLines = args.newString.split('\n').length;

    return `Applied edit to ${resolvedPath} at line ${matchLine}: ${oldLines} line(s) replaced with ${newLines} line(s)`;
  },
};
