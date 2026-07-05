import ora from 'ora';

let spinner: ReturnType<typeof ora> | null = null;

export function startSession(text?: string): void {
  if (spinner) {
    spinner.text = text ?? 'Processing...';
    return;
  }
  spinner = ora({ text: text ?? 'Processing...', spinner: 'dots' }).start();
}

export function stopSession(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
