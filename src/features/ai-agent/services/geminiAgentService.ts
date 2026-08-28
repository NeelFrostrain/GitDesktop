import { AgentMessage, AgentToolCall } from '../types';

export interface GeminiAgentRequestOptions {
  apiKeyPool: string[];
  activeApiKey?: string;
  model?: string;
  systemInstruction?: string;
  messages: AgentMessage[];
  repoContextPrompt?: string;
}

export interface GeminiAgentResponse {
  text: string;
  toolCalls: AgentToolCall[];
  modelUsed: string;
  usedApiKey: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiAgentService {
  /**
   * Sends a structured conversation to the Gemini API with key rotation and tool call extraction.
   */
  static async sendChatMessage(options: GeminiAgentRequestOptions): Promise<GeminiAgentResponse> {
    const {
      apiKeyPool = [],
      activeApiKey = '',
      model = DEFAULT_MODEL,
      systemInstruction = '',
      messages,
      repoContextPrompt = '',
    } = options;

    // Build ordered list of API keys to attempt
    const keysToTry: string[] = [];
    if (activeApiKey.trim()) keysToTry.push(activeApiKey.trim());
    for (const key of apiKeyPool) {
      if (key && key.trim() && !keysToTry.includes(key.trim())) {
        keysToTry.push(key.trim());
      }
    }

    if (keysToTry.length === 0) {
      throw new Error(
        'No Google Gemini API key configured. Please add an API key in Settings > AI / Gemini tab.'
      );
    }

    // Build system instruction
    const fullSystemInstruction = [
      `You are the Git Desktop AI Agent, an expert assistant integrated into Git Desktop.`,
      `Your purpose is to help the user understand their code changes, execute Git operations, craft commits, manage branches, and resolve conflicts safely.`,
      `Guidelines:`,
      `- When the user sends a greeting or small talk (e.g. "hello", "hi", "help"), respond warmly and concisely. Introduce what you can do (e.g. explain diffs, draft commit messages, switch branches, resolve conflicts) and invite them to ask. Do NOT output unprompted full repository analysis unless the user asks for it or uses a template.`,
      `- When the user asks a question or asks to perform a Git operation, provide a clear explanation and format any executable commands inside a markdown code block with \`\`\`bash.`,
      `- The application automatically parses your \`\`\`bash code blocks into 1-click interactive action buttons for the user to execute directly in their integrated terminal.`,
      `- Always prioritize repository safety: warn before potentially destructive commands (e.g. \`git reset --hard\`, \`git clean -fd\`, or force push).`,
      `- Keep your explanations clean, well-formatted with markdown, and concise.`,
      repoContextPrompt ? `\n--- ACTIVE REPOSITORY STATE ---\n${repoContextPrompt}\n--- END REPOSITORY STATE ---` : '',
      systemInstruction,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Build Gemini contents array from conversation history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      let partText = msg.content;

      // Append any message attachments (like diffs, status, etc.)
      if (msg.attachments && msg.attachments.length > 0) {
        const attachmentTexts = msg.attachments
          .map((a) => `[ATTACHMENT: ${a.title}]\n${a.content}\n[/ATTACHMENT]`)
          .join('\n\n');
        partText = `${partText}\n\n${attachmentTexts}`;
      }

      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: partText }],
      });
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: fullSystemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        maxOutputTokens: 3072,
      },
    };

    let lastError: Error | null = null;

    // Try keys in rotation
    for (const apiKey of keysToTry) {
      try {
        const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errBody = await response.text();
          let parsedMessage = `HTTP ${response.status} ${response.statusText}`;
          try {
            const json = JSON.parse(errBody);
            if (json.error?.message) parsedMessage = json.error.message;
          } catch {}

          // If rate limited or quota exceeded, rotate to next key
          if (response.status === 429 || response.status === 403) {
            lastError = new Error(`Key rate limited or quota exceeded: ${parsedMessage}`);
            continue;
          }

          throw new Error(`Gemini API error (${response.status}): ${parsedMessage}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const rawText =
          candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ||
          'I completed the analysis, but no response text was returned.';

        // Extract executable tool calls from response code blocks
        const toolCalls = this.extractToolCalls(rawText);

        return {
          text: rawText,
          toolCalls,
          modelUsed: model,
          usedApiKey: apiKey,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to next key if available
      }
    }

    throw lastError || new Error('Failed to generate response using configured API keys.');
  }

  /**
   * Parses proposed git / shell commands from markdown code blocks into executable tool calls.
   */
  private static extractToolCalls(text: string): AgentToolCall[] {
    const tools: AgentToolCall[] = [];
    const codeBlockRegex = /```(?:bash|sh|shell|git|cmd|powershell)?\s*\n([\s\S]*?)```/gi;

    let match: RegExpExecArray | null;
    let toolIndex = 1;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const codeSnippet = match[1].trim();
      // Only treat single or short multi-line commands starting with common git/shell commands as actionable
      const lines = codeSnippet.split('\n').map((l) => l.trim()).filter(Boolean);
      const isGitOrShell = lines.some(
        (l) =>
          l.startsWith('git ') ||
          l.startsWith('gh ') ||
          l.startsWith('glab ') ||
          l.startsWith('npm ') ||
          l.startsWith('bun ') ||
          l.startsWith('cargo ')
      );

      if (isGitOrShell && lines.length <= 6) {
        tools.push({
          id: `tool-${Date.now()}-${toolIndex++}`,
          name: 'run_command',
          command: codeSnippet,
          status: 'pending',
        });
      }
    }

    return tools;
  }
}
