import type { LLMProvider } from '../llm/provider.js'
import type { Plan, Step, AgentConfig } from './types.js'
import type { SessionContext } from './session.js'

const PLANNER_SYSTEM_PROMPT = `You are a task planner for an AI coding agent. Given a software engineering task, break it down into clear, actionable steps.

Respond with ONLY valid JSON matching this exact structure:
{
  "goal": "one-line summary of the overall goal",
  "complexity": "low" | "medium" | "high",
  "steps": [
    {
      "id": "step-1",
      "description": "what to do in this step",
      "suggestedTools": ["read", "glob", "grep"],
      "expectedOutcome": "what this step should accomplish"
    }
  ]
}

Guidelines:
- Break complex tasks into small, focused steps (2-8 steps)
- Suggest relevant tools for each step from: read, write, edit, glob, bash, grep, webFetch
- Set complexity low for 1-2 steps, medium for 3-5, high for 6+
- Steps should be sequential and logical
- Keep descriptions clear and actionable
- First steps typically involve exploration (read, glob, grep)
- Later steps involve implementation (write, edit, bash)`

export class Planner {
  private provider: LLMProvider
  private config: AgentConfig

  constructor(provider: LLMProvider, config: AgentConfig) {
    this.provider = provider
    this.config = config
  }

  async plan(task: string, context: SessionContext): Promise<Plan> {
    const contextSummary = this.buildContextSummary(context)

    const messages = [
      { role: 'system' as const, content: PLANNER_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Task: ${task}\n\nCurrent context:\n${contextSummary}\n\nCreate a step-by-step plan for this task. Respond with JSON only.`,
      },
    ]

    try {
      const response = await this.provider.chat(messages, {
        model: this.config.model,
        maxTokens: 2048,
        temperature: 0.3,
      })

      return this.parsePlanResponse(response.content || '')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return this.fallbackPlan(task, message)
    }
  }

  private buildContextSummary(context: SessionContext): string {
    const parts: string[] = []
    parts.push(`Mode: ${context.mode}`)
    parts.push(`Iteration: ${context.iteration}`)

    if (context.filesRead.length > 0) {
      parts.push(`Files read: ${context.filesRead.join(', ')}`)
    }
    if (context.filesWritten.length > 0) {
      parts.push(`Files written: ${context.filesWritten.join(', ')}`)
    }

    return parts.join('\n')
  }

  private parsePlanResponse(text: string): Plan {
    let json = text.trim()

    const jsonMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      json = jsonMatch[1].trim()
    }

    const braceStart = json.indexOf('{')
    const braceEnd = json.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd !== -1) {
      json = json.slice(braceStart, braceEnd + 1)
    }

    const parsed = JSON.parse(json)

    if (!parsed.goal || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid plan structure: missing goal or steps')
    }

    const steps: Step[] = parsed.steps.map((s: Record<string, unknown>, i: number) => ({
      id: String(s.id || `step-${i + 1}`),
      description: String(s.description || ''),
      suggestedTools: Array.isArray(s.suggestedTools) ? s.suggestedTools.map(String) : [],
      expectedOutcome: s.expectedOutcome ? String(s.expectedOutcome) : undefined,
    }))

    const complexity = parsed.complexity === 'low' || parsed.complexity === 'medium' || parsed.complexity === 'high'
      ? parsed.complexity
      : steps.length <= 2 ? 'low' : steps.length <= 5 ? 'medium' : 'high'

    return {
      goal: String(parsed.goal),
      steps,
      complexity,
    }
  }

  private fallbackPlan(task: string, error: string): Plan {
    const steps: Step[] = [
      {
        id: 'step-1',
        description: 'Explore the codebase to understand the current structure',
        suggestedTools: ['read', 'glob', 'grep'],
        expectedOutcome: 'Understanding of relevant files and code patterns',
      },
      {
        id: 'step-2',
        description: 'Implement the required changes based on exploration',
        suggestedTools: ['write', 'edit', 'bash'],
        expectedOutcome: 'Changes implemented successfully',
      },
      {
        id: 'step-3',
        description: 'Verify the changes work correctly',
        suggestedTools: ['bash', 'read'],
        expectedOutcome: 'Changes verified and working',
      },
    ]

    return {
      goal: task.length > 100 ? `${task.slice(0, 100)}...` : task,
      steps,
      complexity: 'medium',
    }
  }
}
