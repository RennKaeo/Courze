export interface Tool<T = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: T) => Promise<string>;
}
