import pc from 'picocolors';

export function info(msg: string): void {
  console.log(pc.blue(`ℹ ${msg}`));
}

export function success(msg: string): void {
  console.log(pc.green(`✔ ${msg}`));
}

export function warn(msg: string): void {
  console.log(pc.yellow(`⚠ ${msg}`));
}

export function error(msg: string): void {
  console.error(pc.red(`✖ ${msg}`));
}

export function codeBlock(content: string, lang = ''): void {
  const lines = content.split('\n');
  const maxLine = String(lines.length).length;
  const gutterWidth = maxLine + 2;

  const output = lines
    .map((line, i) => {
      const lineNum = String(i + 1).padStart(maxLine, ' ');
      return pc.dim(`${lineNum} │`) + ` ${line}`;
    })
    .join('\n');

  const header = lang
    ? pc.cyan(`┌─ ${pc.bold(lang)} ${pc.dim('─'.repeat(Math.max(0, 40 - lang.length - 4)))}┐`)
    : pc.dim(`┌────${'─'.repeat(38)}┐`);
  const footer = pc.dim(`└${'─'.repeat(gutterWidth + 1)}${'─'.repeat(Math.max(1, 40))}┘`);

  console.log(`\n${header}\n${pc.dim('│')} ${output}\n${footer}\n`);
}

export function divider(): void {
  console.log(pc.dim('─'.repeat(process.stdout.columns ?? 60)));
}

export interface ToolCallDisplay {
  tool: string;
  input: string;
  result?: string;
}

export function formatToolCall(call: ToolCallDisplay): void {
  console.log(`\n  ${pc.cyan('→')} ${pc.bold(call.tool)}`);

  if (call.input) {
    const preview =
      call.input.length > 200
        ? `${call.input.slice(0, 200)}…`
        : call.input;
    console.log(`    ${pc.dim('Input:')}  ${preview}`);
  }

  if (call.result) {
    const preview =
      call.result.length > 200
        ? `${call.result.slice(0, 200)}…`
        : call.result;
    console.log(`    ${pc.dim('Result:')} ${pc.green(preview)}`);
  }
}

export function formatAgentMessage(msg: string): void {
  if (!msg) return;
  console.log(`\n${pc.bold('Agent')}: ${msg}`);
}
