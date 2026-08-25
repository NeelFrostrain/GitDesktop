import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor';
import { Loader2, AlertCircle } from 'lucide-react';
import { GitService } from '../../../services/git/gitService';
import { useAppLogStore } from '../../../core/logging/logStore';
import { useToastStore } from '../../../store/useToastStore';

// In-memory buffer cache across mode switches to prevent discarding edits
const fileBufferCache = new Map<string, string>();

export interface FileEditorHandle {
  save: () => Promise<void>;
  revert: () => void;
}

export interface FileEditorState {
  isDirty: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
}

interface FileEditorViewProps {
  repoPath: string;
  filePath: string;
  isStaged?: boolean;
  onSaved?: () => void;
  onExitEditMode?: () => void;
  onStateChange?: (state: FileEditorState) => void;
  editorRefHandle?: React.RefObject<FileEditorHandle | null>;
}

function getMonacoLanguage(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) return 'typescript';
  if (lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
  if (lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.scss') || lower.endsWith('.sass')) return 'scss';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh')) return 'shell';
  if (lower.endsWith('.toml')) return 'ini';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
  if (lower.endsWith('.go')) return 'go';
  if (lower.endsWith('.c') || lower.endsWith('.h')) return 'c';
  if (lower.endsWith('.cpp') || lower.endsWith('.hpp') || lower.endsWith('.cc')) return 'cpp';
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.gitignore') || lower.endsWith('.dockerignore') || lower.endsWith('.env')) return 'ini';
  return 'plaintext';
}

/**
 * Minimal Inline Code Editor powered by Monaco Editor
 */
export const FileEditorView: React.FC<FileEditorViewProps> = ({
  repoPath,
  filePath,
  isStaged = false,
  onSaved,
  onExitEditMode,
  onStateChange,
  editorRefHandle,
}) => {
  const cacheKey = `${repoPath}:${filePath}`;
  const [content, setContent] = useState<string>(() => fileBufferCache.get(cacheKey) || '');
  const [originalDiskContent, setOriginalDiskContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Status metrics
  const [cursorLine, setCursorLine] = useState<number>(1);
  const [cursorCol, setCursorCol] = useState<number>(1);
  const [totalLines, setTotalLines] = useState<number>(1);

  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const isDirty = content !== originalDiskContent;
  const language = useMemo(() => getMonacoLanguage(filePath), [filePath]);

  // Sync state upward to parent for DiffHeader controls
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ isDirty, isSaving, saveSuccess });
    }
  }, [isDirty, isSaving, saveSuccess, onStateChange]);

  // Load disk content on mount or file change
  useEffect(() => {
    let isDisposed = false;
    setIsLoading(true);
    setError(null);

    GitService.readFileContent(repoPath, filePath)
      .then((diskText) => {
        if (!isDisposed) {
          setOriginalDiskContent(diskText);
          if (!fileBufferCache.has(cacheKey)) {
            setContent(diskText);
            setTotalLines(diskText.split('\n').length);
          } else {
            const cached = fileBufferCache.get(cacheKey) || diskText;
            setContent(cached);
            setTotalLines(cached.split('\n').length);
          }
        }
      })
      .catch((err) => {
        if (!isDisposed) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to read file: ${msg}`);
        }
      })
      .finally(() => {
        if (!isDisposed) setIsLoading(false);
      });

    return () => {
      isDisposed = true;
    };
  }, [repoPath, filePath, cacheKey]);

  // Save changes to disk & auto re-stage if previously staged
  const handleSave = useCallback(async () => {
    const currentText = editorRef.current ? editorRef.current.getValue() : content;
    if (!repoPath || !filePath || isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      // 1. Write file to disk
      await GitService.saveFileContent(repoPath, filePath, currentText);
      setContent(currentText);
      setOriginalDiskContent(currentText);
      fileBufferCache.delete(cacheKey);

      // 2. If the file was staged, automatically re-stage the updated content
      if (isStaged) {
        await GitService.stageFiles(repoPath, [filePath]);
        useAppLogStore
          .getState()
          .addLog('Success', 'Git', `Re-staged updated file: ${filePath}`);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      useAppLogStore.getState().addLog('Success', 'Git', `Saved ${filePath} to disk`);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'File Saved',
        message: `Saved '${filePath}'`,
      });

      // 3. Trigger diff & status reload
      if (onSaved) onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to save: ${msg}`);
      useAppLogStore.getState().addLog('Error', 'Git', `Failed to save ${filePath}: ${msg}`);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Save Failed',
        message: msg,
      });
    } finally {
      setIsSaving(false);
    }
  }, [repoPath, filePath, content, isSaving, isStaged, cacheKey, onSaved]);

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  // Global window Ctrl+S listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Revert unsaved edits back to disk content
  const handleRevert = useCallback(() => {
    setContent(originalDiskContent);
    fileBufferCache.delete(cacheKey);
    if (editorRef.current) {
      editorRef.current.setValue(originalDiskContent);
    }
  }, [originalDiskContent, cacheKey]);

  // Bind imperative handle to ref
  useImperativeHandle(editorRefHandle, () => ({
    save: handleSave,
    revert: handleRevert,
  }), [handleSave, handleRevert]);

  // Configure Monaco theme & custom autocompletion providers
  const handleBeforeMount = (monaco: Monaco) => {
    monacoRef.current = monaco;

    // Configure Monaco TypeScript & JavaScript diagnostics so embedded editor doesn't show false module resolution squiggles
    if (monaco.languages?.typescript) {
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTextFiles: true,
        allowSyntheticDefaultImports: true,
        allowJs: true,
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      });
    }

    // Define Obsidian / Commito dark theme
    monaco.editor.defineTheme('commito-obsidian', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5c5863', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'e05638', fontStyle: 'bold' },
        { token: 'string', foreground: '4ade80' },
        { token: 'number', foreground: 'facc15' },
        { token: 'type', foreground: '38bdf8' },
        { token: 'identifier', foreground: 'e6e4e8' },
        { token: 'delimiter', foreground: '85818c' },
      ],
      colors: {
        'editor.background': '#121113',
        'editor.foreground': '#e6e4e8',
        'editorCursor.foreground': '#e05638',
        'editor.lineHighlightBackground': '#171619',
        'editorLineNumber.foreground': '#5c5863',
        'editorLineNumber.activeForeground': '#e05638',
        'editor.selectionBackground': '#382221',
        'editor.inactiveSelectionBackground': '#241a1c',
        'editorWidget.background': '#171619',
        'editorWidget.border': '#29272b',
        'editorSuggestWidget.background': '#171619',
        'editorSuggestWidget.border': '#29272b',
        'editorSuggestWidget.foreground': '#e6e4e8',
        'editorSuggestWidget.selectedBackground': '#201e22',
        'editorSuggestWidget.highlightForeground': '#e05638',
        'scrollbarSlider.background': '#29272b80',
        'scrollbarSlider.hoverBackground': '#3d3a42',
        'scrollbarSlider.activeBackground': '#e0563880',
      },
    });

    // Register smart pattern autocomplete for .gitignore and config files
    monaco.languages.registerCompletionItemProvider('ini', {
      provideCompletionItems: (model: monacoEditor.editor.ITextModel, position: monacoEditor.Position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const match = textUntilPosition.match(/\S+$/);
        const word = match ? match[0] : '';

        const gitignorePatterns = [
          { label: 'node_modules/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'Node dependencies' },
          { label: 'dist/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'Build outputs' },
          { label: 'build/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'Compiled artifacts' },
          { label: 'target/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'Rust target dir' },
          { label: '.env', kind: monaco.languages.CompletionItemKind.File, detail: 'Secrets & env vars' },
          { label: '.env.local', kind: monaco.languages.CompletionItemKind.File, detail: 'Local env overrides' },
          { label: '*.log', kind: monaco.languages.CompletionItemKind.Value, detail: 'Log files pattern' },
          { label: '*.tmp', kind: monaco.languages.CompletionItemKind.Value, detail: 'Temp files pattern' },
          { label: '.DS_Store', kind: monaco.languages.CompletionItemKind.File, detail: 'macOS metadata' },
          { label: '.idea/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'JetBrains config' },
          { label: '.vscode/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'VS Code workspace' },
          { label: 'coverage/', kind: monaco.languages.CompletionItemKind.Folder, detail: 'Test coverage' },
          { label: '*.lock', kind: monaco.languages.CompletionItemKind.Value, detail: 'Lockfiles pattern' },
          { label: 'package-lock.json', kind: monaco.languages.CompletionItemKind.File, detail: 'NPM lockfile' },
          { label: 'bun.lockb', kind: monaco.languages.CompletionItemKind.File, detail: 'Bun binary lockfile' },
          { label: 'Cargo.lock', kind: monaco.languages.CompletionItemKind.File, detail: 'Rust lockfile' },
        ];

        const range = {
          startLineNumber: position.lineNumber,
          startColumn: Math.max(1, position.column - word.length),
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };

        return {
          suggestions: gitignorePatterns.map((item) => ({
            ...item,
            insertText: item.label,
            range,
          })),
        };
      },
    });
  };

  const handleEditorOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position & total lines
    editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber);
      setCursorCol(e.position.column);
    });

    editor.onDidChangeModelContent(() => {
      const val = editor.getValue();
      setContent(val);
      fileBufferCache.set(cacheKey, val);
      setTotalLines(editor.getModel()?.getLineCount() || 1);
    });

    // Keybinding: Ctrl+S to Save inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current();
    });

    // Keybinding: Escape to exit edit mode back to Diff
    editor.addCommand(monaco.KeyCode.Escape, () => {
      if (onExitEditMode) {
        onExitEditMode();
      }
    });

    editor.focus();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-base-0 text-text-muted gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-commito-coral" />
        <span className="text-xs font-mono">Loading file buffer...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-base-0 text-text-primary select-text relative">
      {/* 1. Error Banner if write fails */}
      {error && (
        <div className="px-3 py-1.5 bg-git-removed-bg border-b border-git-removed/30 text-git-removed text-xs flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Monaco Editor Core Container */}
      <div className="flex-1 min-h-0 relative bg-base-0 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="commito-obsidian"
          beforeMount={handleBeforeMount}
          onMount={handleEditorOnMount}
          options={{
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
            fontSize: 12.5,
            lineHeight: 20,
            minimap: { enabled: false },
            lineNumbers: 'on',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            wordWrap: 'on',
            tabSize: 2,
            insertSpaces: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'smart',
            snippetSuggestions: 'inline',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            contextmenu: true,
            renderLineHighlight: 'line',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* 3. Keyboard Shortcuts Footer Bar */}
      <div className="h-6 px-3 bg-base-1 border-t border-border flex items-center justify-between shrink-0 select-none text-[10.5px] font-mono text-text-muted">
        <div className="flex items-center gap-2.5">
          <span>Ln {cursorLine}, Col {cursorCol}</span>
          <span>•</span>
          <span>{totalLines} lines</span>
          <span>•</span>
          <span>{content.length} chars</span>
        </div>

        {/* Shortcuts Prompt Footer */}
        <div className="flex items-center gap-3 text-text-faint">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 bg-base-2 border border-border rounded-xs text-text-muted">Tab</kbd> Accept
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 bg-base-2 border border-border rounded-xs text-text-muted">Ctrl+Space</kbd> Suggest
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 bg-base-2 border border-border rounded-xs text-text-muted">Ctrl+S</kbd> Save
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.2 bg-base-2 border border-border rounded-xs text-text-muted">Esc</kbd> Back to Diff
          </span>
          <span>•</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
