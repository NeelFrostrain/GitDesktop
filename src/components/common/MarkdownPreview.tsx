import React, { useMemo } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { renderSafeMarkdown } from '../../shared/utils/markdown';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
  emptyText?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  emptyText = 'No markdown content to preview.',
}) => {
  const html = useMemo(() => {
    if (!content.trim()) return '';
    try {
      return renderSafeMarkdown(content);
    } catch {
      return content;
    }
  }, [content]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      try {
        openUrl(anchor.href);
      } catch {
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  if (!content.trim()) {
    return (
      <div className={`text-text-faint italic text-center py-6 text-xs select-none ${className}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
      className={`markdown-body text-xs text-text-secondary leading-relaxed select-text space-y-2 prose-invert ${className}`}
    />
  );
};
