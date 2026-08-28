import { AgentMessage, AgentToolCall } from '../types';
import { ToonService } from './toonService';

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
   * Sends a structured conversation to the Gemini API with key rotation, TOON format optimization, and tool call extraction.
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

    // Build system instruction with TOON token-efficiency support
    const fullSystemInstruction = [
      `You are the Git Desktop AI Agent & Coding Assistant, an expert coding and Git assistant integrated directly into Git Desktop.`,
      `You have full capabilities to explain code, write code, create files, edit files, delete files, manage branches, and execute Git operations safely.`,
      `Guidelines:`,
      `- When the user sends a greeting or small talk (e.g. "hello", "hi", "help"), respond warmly and concisely. Introduce what you can do (write/edit files, run Git commands, analyze diffs, resolve conflicts).`,
      `- To execute terminal/git commands, format the command in a \`\`\`bash markdown code block. The app turns this into a 1-click execution button for the user's terminal.`,
      `- To CREATE or EDIT a file in the repository, output:`,
      `  [FILE_WRITE: relative/path/to/file.ext]`,
      `  \`\`\`language`,
      `  // full file contents here...`,
      `  \`\`\``,
      `  [/FILE_WRITE]`,
      `- To DELETE a file or folder in the repository, output:`,
      `  [FILE_DELETE: relative/path/to/file.ext]`,
      `- Always provide the full updated file contents when creating or writing files so they can be saved directly.`,
      `- Keep your explanations clean, well-formatted with markdown, and concise.`,
      `- Note: Context, git states, and terminal outputs are encoded in TOON (Token-Oriented Object Notation, https://github.com/toon-format/toon) for ultra-low token consumption. Tables are written as name[N]{cols}: with row values.`,
      repoContextPrompt ? `\n--- ACTIVE REPOSITORY STATE (TOON FORMAT) ---\n${repoContextPrompt}\n--- END REPOSITORY STATE ---` : '',
      systemInstruction,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Build Gemini contents array from conversation history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      let partText = msg.content;

      // Append any message attachments (like diffs, terminal logs, status) formatted with TOON
      if (msg.attachments && msg.attachments.length > 0) {
        const attachmentTexts = msg.attachments
          .map((a) => ToonService.formatAttachmentForPrompt(a))
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
        maxOutputTokens: 4096,
      },
    };

    let lastError: Error | null = null;

    // Try keys in rotation
    for (const apiKey of keysToTry) {
      try {
        const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errBody = await response.text();
          let parsedMessage = errBody;
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

        // Extract executable tool calls from response code blocks & file markers
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
   * Parses proposed git / shell commands and file write/delete operations into executable tool calls.
   */
  private static extractToolCalls(text: string): AgentToolCall[] {
    const tools: AgentToolCall[] = [];
    let toolIndex = 1;

    // 1. Extract [FILE_WRITE: path] ... [/FILE_WRITE]
    const fileWriteRegex =
      /\[FILE_WRITE:\s*([^\s\]]+)\][\s\S]*?```(?:[a-zA-Z0-9_-]+)?\s*(?:\r?\n)([\s\S]*?)```[\s\S]*?\[\/FILE_WRITE\]/gi;
    let writeMatch: RegExpExecArray | null;
    while ((writeMatch = fileWriteRegex.exec(text)) !== null) {
      const filePath = writeMatch[1].trim();
      const fileContent = writeMatch[2];
      tools.push({
        id: `tool-${Date.now()}-${toolIndex++}`,
        name: 'write_file',
        filePath,
        fileContent,
        status: 'pending',
      });
    }

    // 2. Extract [FILE_DELETE: path]
    const fileDeleteRegex = /\[FILE_DELETE:\s*([^\s\]]+)\]/gi;
    let deleteMatch: RegExpExecArray | null;
    while ((deleteMatch = fileDeleteRegex.exec(text)) !== null) {
      const filePath = deleteMatch[1].trim();
      tools.push({
        id: `tool-${Date.now()}-${toolIndex++}`,
        name: 'delete_file',
        filePath,
        status: 'pending',
      });
    }

    // 3. Fallback: Extract code blocks with filepath header (e.g. ```tsx:src/App.tsx)
    const annotatedCodeRegex =
      /```(?:[a-zA-Z0-9_-]+)?(?::|\s+filepath=|\s+file=)([^\s\r\n]+)\s*(?:\r?\n)([\s\S]*?)```/gi;
    let annotMatch: RegExpExecArray | null;
    while ((annotMatch = annotatedCodeRegex.exec(text)) !== null) {
      const filePath = annotMatch[1].trim();
      const fileContent = annotMatch[2];
      if (!tools.some((t) => t.filePath === filePath)) {
        tools.push({
          id: `tool-${Date.now()}-${toolIndex++}`,
          name: 'write_file',
          filePath,
          fileContent,
          status: 'pending',
        });
      }
    }

    // 4. Extract bash/shell commands from code blocks
    const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\s*(?:\r?\n)([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const lang = (match[1] || '').toLowerCase().trim();
      const codeSnippet = match[2].trim();
      const lines = codeSnippet.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const isShellLang = ['bash', 'sh', 'shell', 'git', 'cmd', 'powershell', 'zsh'].includes(lang);
      const isGitOrShellCommand = lines.some(
        (l) =>
          l.startsWith('git ') ||
          l.startsWith('gh ') ||
          l.startsWith('glab ') ||
          l.startsWith('npm ') ||
          l.startsWith('bun ') ||
          l.startsWith('cargo ') ||
          l.startsWith('node ') ||
          l.startsWith('rm ') ||
          l.startsWith('del ') ||
          l.startsWith('mkdir ')
      );

      if ((isShellLang || isGitOrShellCommand) && lines.length <= 8) {
        if (!tools.some((t) => t.command === codeSnippet)) {
          tools.push({
            id: `tool-${Date.now()}-${toolIndex++}`,
            name: 'run_command',
            command: codeSnippet,
            status: 'pending',
          });
        }
      }
    }

    return tools;
  }
}
