import { AgentMessage, AgentToolCall } from '../types';
import { ToonService } from './toonService';

export interface GeminiAgentRequestOptions {
  apiKeyPool: string[];
  activeApiKey?: string;
  model?: string;
  systemInstruction?: string;
  messages: AgentMessage[];
  repoContextPrompt?: string;
  agentName?: string;
}

export interface GeminiAgentResponse {
  text: string;
  toolCalls: AgentToolCall[];
  modelUsed: string;
  usedApiKey: string;
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiAgentService {
  /**
   * Sends a structured conversation to the Gemini API with key rotation, TOON format optimization, and tool call extraction.
   */
  static async sendChatMessage(options: GeminiAgentRequestOptions): Promise<GeminiAgentResponse> {
    return this.streamChatMessage(options);
  }

  /**
   * Streams chat completions from Google Gemini API via Server-Sent Events (SSE),
   * providing live word-by-word token callbacks, API key rotation, and tool call parsing.
   */
  static async streamChatMessage(
    options: GeminiAgentRequestOptions,
    onChunk?: (chunk: string, fullText: string) => void,
    signal?: AbortSignal
  ): Promise<GeminiAgentResponse> {
    const {
      apiKeyPool = [],
      activeApiKey = '',
      model = DEFAULT_MODEL,
      systemInstruction = '',
      messages,
      repoContextPrompt = '',
      agentName,
    } = options;

    const nameToUse = agentName?.trim() || 'AI Git Agent';

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
      `You are ${nameToUse}, an expert coding and Git assistant integrated directly into Git Desktop.`,
      `You have full capabilities to explain code, write code, create files, edit files, delete files, manage branches, and execute Git operations safely.`,
      `Guidelines:`,
      `- When the user sends a greeting or asks for your identity/name (e.g. "hello", "hi", "who are you"), respond warmly and introduce yourself as ${nameToUse}. Briefly introduce what you can do (write/edit files, run Git commands, analyze diffs, resolve conflicts).`,
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
      repoContextPrompt
        ? `\n--- ACTIVE REPOSITORY STATE (TOON FORMAT) ---\n${repoContextPrompt}\n--- END REPOSITORY STATE ---`
        : '',
      systemInstruction,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Build Gemini contents array from conversation history with strictly alternating user/model
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      let partText = msg.content || '';

      // Append any message attachments (like diffs, terminal logs, status) formatted with TOON
      if (msg.attachments && msg.attachments.length > 0) {
        const attachmentTexts = msg.attachments
          .map((a) => ToonService.formatAttachmentForPrompt(a))
          .join('\n\n');
        partText = partText ? `${partText}\n\n${attachmentTexts}` : attachmentTexts;
      }

      if (!partText.trim()) continue;

      const role: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';

      const lastContent = contents[contents.length - 1];
      if (lastContent && lastContent.role === role) {
        lastContent.parts[0].text += `\n\n${partText}`;
      } else {
        contents.push({
          role,
          parts: [{ text: partText }],
        });
      }
    }

    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    if (contents.length === 0) {
      throw new Error('No user prompt found to regenerate.');
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

    // Candidate fallback models if selected model returns 404 or is unavailable
    const modelsToTry = [model];
    for (const fb of [
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.7-flash',
    ]) {
      if (!modelsToTry.includes(fb)) {
        modelsToTry.push(fb);
      }
    }

    // Try keys in rotation and fallback models on 404
    for (const apiKey of keysToTry) {
      for (const targetModel of modelsToTry) {
        if (signal?.aborted) {
          throw new DOMException('Generation stopped by user', 'AbortError');
        }

        try {
          const streamUrl = `${API_BASE}/${targetModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

          const response = await fetch(streamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal,
          });

          if (!response.ok) {
            const errBody = await response.text();
            let parsedMessage = errBody;
            try {
              const json = JSON.parse(errBody);
              if (json.error?.message) parsedMessage = json.error.message;
            } catch {}

            if (response.status === 404) {
              lastError = new Error(`Model ${targetModel} not found (404), trying fallback...`);
              continue; // Try next fallback model
            }

            if (response.status === 429 || response.status === 403) {
              lastError = new Error(`Key rate limited or quota exceeded: ${parsedMessage}`);
              break; // Switch API key
            }

            throw new Error(`Gemini API error (${response.status}): ${parsedMessage}`);
          }

          if (!response.body) {
            throw new Error('Response body is null, cannot stream SSE data.');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulatedText = '';
          let sseBuffer = '';

          try {
            while (true) {
              if (signal?.aborted) {
                await reader.cancel();
                break;
              }

              const { done, value } = await reader.read();
              if (done) break;

              sseBuffer += decoder.decode(value, { stream: true });
              const lines = sseBuffer.split('\n');
              sseBuffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                  const dataJson = trimmed.slice(6).trim();
                  if (!dataJson || dataJson === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(dataJson);
                    const candidate = parsed.candidates?.[0];
                    const chunkText =
                      candidate?.content?.parts
                        ?.map((p: { text?: string }) => p.text || '')
                        .join('') || '';

                    if (chunkText) {
                      accumulatedText += chunkText;
                      if (onChunk) {
                        onChunk(chunkText, accumulatedText);
                      }
                    }
                  } catch {
                    // Partial JSON chunk, will be resolved with next line or ignored
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          const finalText =
            accumulatedText.trim() || 'I completed the request, but no response was returned.';
          const toolCalls = this.extractToolCalls(finalText);

          return {
            text: finalText,
            toolCalls,
            modelUsed: targetModel,
            usedApiKey: apiKey,
          };
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw err;
          }
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
    }

    throw lastError || new Error('Failed to stream response using configured API keys.');
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
      const lines = codeSnippet
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
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
