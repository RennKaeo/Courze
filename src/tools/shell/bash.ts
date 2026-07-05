import { execa } from 'execa';
import type { Tool } from '../types.js';

const MAX_OUTPUT_CHARS = 10000;
const DEFAULT_TIMEOUT = 120_000;

interface BashArgs {
  command: string;
  timeout?: number;
  workdir?: string;
}

const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\/\s*$/m,
  /rm\s+-rf\s+\/\*/m,
  /rm\s+-rf\s+\/\\*/m,
  /rm\s+-rf\s+--no-preserve-root/m,
  /mkfs\./m,
  /dd\s+if=\/dev\/zero/m,
  /dd\s+if=\/dev\/random/m,
  />\s*\/dev\/sda/m,
  /:\(\)\s*\{/m,
  /chmod\s+-R\s+0\s+\//m,
  /chown\s+-R.*\s+\//m,
  /wget\s+.*\s+\|\s*bash/m,
  /curl\s+.*\s+\|\s*bash/m,
  /shutdown\s+-[rhH]/m,
  /reboot/m,
  /poweroff/m,
  /halt/m,
];

function isDangerous(command: string): boolean {
  const trimmed = command.trim();
  if (trimmed.length > 2000) {
    return false;
  }

  const normalized = trimmed.replace(/\\\n/g, ' ').replace(/\s+/g, ' ');
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(normalized));
}

export const bashTool: Tool<BashArgs> = {
  name: 'bash',
  description: 'Execute a shell command with timeout and output truncation. Blocks dangerous commands.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      timeout: {
        type: 'number',
        description: `Timeout in milliseconds (default: ${DEFAULT_TIMEOUT})`,
      },
      workdir: {
        type: 'string',
        description: 'Working directory for the command',
      },
    },
    required: ['command'],
  },

  async handler(args: BashArgs): Promise<string> {
    if (isDangerous(args.command)) {
      return 'Error: Command blocked for security reasons (appears to be a dangerous system operation)';
    }

    try {
      const result = await execa(args.command, {
        shell: true,
        timeout: args.timeout ?? DEFAULT_TIMEOUT,
        cwd: args.workdir,
        all: true,
        reject: false,
      });

      let output = result.all ?? '';

      if (output.length > MAX_OUTPUT_CHARS) {
        output = output.slice(0, MAX_OUTPUT_CHARS) + `\n... (truncated, ${output.length - MAX_OUTPUT_CHARS} more characters)`;
      }

      if (result.exitCode === null) {
        return `Command timed out after ${(args.timeout ?? DEFAULT_TIMEOUT) / 1000}s\n\n${output}`;
      }

      if (result.exitCode !== 0 && !output) {
        output = `Command exited with code ${result.exitCode}`;
      }

      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error executing command: ${message}`;
    }
  },
};
