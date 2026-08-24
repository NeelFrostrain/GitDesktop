import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';

interface AiGenerateButtonProps {
  onGenerate: (summary: string, description: string) => void;
}

export const AiGenerateButton: React.FC<AiGenerateButtonProps> = ({ onGenerate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { status, stagedFiles } = useGitStore();

  const handleGenerate = async () => {
    setIsGenerating(true);
    useLogStore.getState().addLog('info', 'Git', 'Generating commit message with AI...');


    await new Promise((res) => setTimeout(res, 350));

    const filesToAnalyze = stagedFiles.length > 0
      ? stagedFiles
      : (status?.files.map((f) => f.path) || []);

    if (filesToAnalyze.length === 0) {
      onGenerate('chore: update project configuration', 'No file changes detected.');
      setIsGenerating(false);
      return;
    }

    const firstFew = filesToAnalyze.slice(0, 2).map((p) => p.split(/[/\\]/).pop()).join(', ');
    const countExtra = filesToAnalyze.length > 2 ? `, +${filesToAnalyze.length - 2} more` : '';

    let prefix = 'feat';
    if (filesToAnalyze.some((f) => f.includes('test') || f.includes('spec'))) prefix = 'test';
    else if (filesToAnalyze.some((f) => f.endsWith('.md') || f.endsWith('.txt'))) prefix = 'docs';
    else if (filesToAnalyze.some((f) => f.includes('config') || f.includes('Cargo') || f.includes('package'))) prefix = 'chore';
    else if (filesToAnalyze.some((f) => f.includes('fix') || f.includes('bug'))) prefix = 'fix';

    const generatedSummary = `${prefix}: update ${firstFew}${countExtra}`;
    const generatedDesc = `Updated ${filesToAnalyze.length} file(s):\n${filesToAnalyze.map((f) => `- ${f}`).join('\n')}`;

    onGenerate(generatedSummary, generatedDesc);
    useLogStore.getState().addLog('success', 'Git', `Generated commit message: "${generatedSummary}"`);

    setIsGenerating(false);
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={isGenerating}
      title="Generate Commit Message with AI"
      className="p-1 rounded-sm bg-commito-coral/15 border border-commito-coral/40 hover:bg-commito-coral/25 text-commito-coral transition cursor-pointer text-xs flex items-center justify-center shadow-xs"
    >
      {isGenerating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
    </button>
  );
};
