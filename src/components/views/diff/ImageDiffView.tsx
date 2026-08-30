import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Sliders,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { CopyButton } from './diffUtils';
import { GitService } from '../../../services/git/gitService';
import { ImageDiffData } from '../../../types/git';
import { Tabs, TabItem } from '../../common/Tabs';

export interface ImageDiffViewProps {
  filePath: string;
  repoPath: string;
  commitSha?: string;
  staged?: boolean;
}

type ViewMode = '2-up' | 'swipe' | 'onion-skin' | 'difference';

function formatSizeGitHub(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

const VIEW_TABS: TabItem<ViewMode>[] = [
  { id: '2-up', label: '2-up' },
  { id: 'swipe', label: 'Swipe' },
  { id: 'onion-skin', label: 'Onion Skin' },
  { id: 'difference', label: 'Difference' },
];

export const ImageDiffView: React.FC<ImageDiffViewProps> = ({
  filePath,
  repoPath,
  commitSha,
  staged = false,
}) => {
  const [data, setData] = useState<ImageDiffData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 2-up, Swipe, Onion Skin, Difference
  const [viewMode, setViewMode] = useState<ViewMode>('2-up');
  const [swipePos, setSwipePos] = useState<number>(50); // 0 to 100%
  const [onionSkinOpacity, setOnionSkinOpacity] = useState<number>(50); // 0 to 100%

  // Natural dimensions
  const [currDims, setCurrDims] = useState<{ width: number; height: number } | null>(null);
  const [prevDims, setPrevDims] = useState<{ width: number; height: number } | null>(null);

  const swipeBoxRef = useRef<HTMLDivElement>(null);
  const isDraggingSwipe = useRef(false);

  useEffect(() => {
    let isDisposed = false;
    setIsLoading(true);
    setError(null);
    setCurrDims(null);
    setPrevDims(null);

    GitService.getImageDiffData(repoPath, filePath, commitSha)
      .then((res) => {
        if (isDisposed) return;
        setData(res);
        setIsLoading(false);
      })
      .catch((_err) => {
        if (isDisposed) return;
        const fullPath = repoPath ? `${repoPath}/${filePath}`.replace(/\\/g, '/') : '';
        const fallbackUrl = fullPath ? convertFileSrc(fullPath) : '';
        setData({
          file_path: filePath,
          current_data_url: fallbackUrl,
          previous_data_url: null,
          current_size_bytes: 0,
          previous_size_bytes: 0,
          mime_type: 'image/png',
          is_new: false,
          is_deleted: false,
          is_modified: false,
        });
        setIsLoading(false);
      });

    return () => {
      isDisposed = true;
    };
  }, [repoPath, filePath, commitSha]);

  const hasBoth = Boolean(data?.current_data_url && data?.previous_data_url);

  const updateSwipeFromEvent = (clientX: number) => {
    if (!swipeBoxRef.current) return;
    const rect = swipeBoxRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSwipePos(Number(percent.toFixed(1)));
  };

  const handleStartSwipe = (e: React.MouseEvent | React.PointerEvent) => {
    isDraggingSwipe.current = true;
    updateSwipeFromEvent(e.clientX);
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent | MouseEvent) => {
      if (!isDraggingSwipe.current) return;
      updateSwipeFromEvent(e.clientX);
    };

    const handleGlobalPointerUp = () => {
      isDraggingSwipe.current = false;
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('mousemove', handleGlobalPointerMove);
    window.addEventListener('mouseup', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('mousemove', handleGlobalPointerMove);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-base-0 text-text-muted gap-2.5 select-none">
        <Loader2 className="w-5 h-5 animate-spin text-commito-coral" />
        <span className="text-xs font-medium">Loading image diff...</span>
      </div>
    );
  }

  if (error || (!data?.current_data_url && !data?.previous_data_url)) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-base-0 text-text-muted p-6 text-center select-none">
        <AlertCircle className="w-8 h-8 text-danger mb-2 opacity-80" />
        <h3 className="text-sm font-bold text-text-primary mb-1">Image Preview Unavailable</h3>
        <p className="text-xs text-text-muted max-w-sm">
          Unable to load image binary for <span className="font-mono text-text-primary">{filePath}</span>.
        </p>
      </div>
    );
  }

  const currentUrl = data?.current_data_url || '';
  const previousUrl = data?.previous_data_url || '';
  const sizeDiff = (data?.current_size_bytes || 0) - (data?.previous_size_bytes || 0);
  const percentChange =
    (data?.previous_size_bytes || 0) > 0
      ? Math.round(((data?.current_size_bytes || 0) / (data?.previous_size_bytes || 1)) * 100)
      : 100;

  return (
    <div className="h-full flex flex-col bg-base-0 text-text-primary select-none overflow-hidden font-sans">
      {/* Top Header: matches DiffHeader height and theme tokens */}
      <div className="h-9 px-3 bg-base-1 border-b border-border flex items-center justify-between shrink-0 text-xs select-none">
        {/* Left: File info */}
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="font-mono text-xs font-semibold text-text-primary truncate max-w-[280px]">
            {filePath}
          </span>
          <CopyButton text={filePath} />

          {staged && (
            <span className="px-1.5 py-0.2 bg-git-added-bg text-git-added border border-git-added/30 rounded-xs text-[10px] font-bold uppercase tracking-wider">
              Staged
            </span>
          )}
        </div>

        {/* Right: Custom Tabs Component */}
        {hasBoth ? (
          <div className="flex items-center gap-2">
            <Tabs<ViewMode>
              tabs={VIEW_TABS}
              activeTab={viewMode}
              onChange={(mode) => setViewMode(mode)}
              size="xs"
              variant="segmented"
            />
          </div>
        ) : (
          <div className="text-xs font-medium text-text-muted">
            {data?.is_new ? (
              <span className="text-git-added font-semibold">Added Image</span>
            ) : data?.is_deleted ? (
              <span className="text-git-removed font-semibold">Deleted Image</span>
            ) : (
              'Image Preview'
            )}
          </div>
        )}
      </div>

      {/* Main Diff Content Canvas */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center bg-base-0">
        {/* 1. 2-UP SIDE BY SIDE MODE */}
        {viewMode === '2-up' && hasBoth && (
          <div className="flex flex-col items-center justify-center gap-3.5 max-w-full">
            <div className="flex items-center justify-center gap-8 max-w-full">
              {/* Deleted (Old) Image Box */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-git-removed mb-2 font-mono tracking-wider uppercase">
                  Deleted
                </span>
                <div className="w-[360px] h-[360px] md:w-[420px] md:h-[420px] bg-base-1 border border-git-removed/70 rounded-sm flex items-center justify-center p-3 shadow-sm overflow-hidden">
                  <img
                    src={previousUrl}
                    alt="Deleted"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setPrevDims({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="max-w-full max-h-full object-contain drop-shadow-sm"
                  />
                </div>
                <div className="mt-2 text-xs font-mono text-text-muted text-center">
                  W: {prevDims?.width || currDims?.width || '—'}px | H:{' '}
                  {prevDims?.height || currDims?.height || '—'}px | Size:{' '}
                  {formatSizeGitHub(data?.previous_size_bytes || 0)}
                </div>
              </div>

              {/* Added (New) Image Box */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-git-added mb-2 font-mono tracking-wider uppercase">
                  Added
                </span>
                <div className="w-[360px] h-[360px] md:w-[420px] md:h-[420px] bg-base-1 border border-git-added/70 rounded-sm flex items-center justify-center p-3 shadow-sm overflow-hidden">
                  <img
                    src={currentUrl}
                    alt="Added"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setCurrDims({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="max-w-full max-h-full object-contain drop-shadow-sm"
                  />
                </div>
                <div className="mt-2 text-xs font-mono text-text-muted text-center">
                  W: {currDims?.width || prevDims?.width || '—'}px | H:{' '}
                  {currDims?.height || prevDims?.height || '—'}px | Size:{' '}
                  {formatSizeGitHub(data?.current_size_bytes || 0)}
                </div>
              </div>
            </div>

            {/* Bottom Diff Metric */}
            <div className="mt-1 text-xs font-mono text-text-muted">
              Diff:{' '}
              <span
                className={`font-semibold ${
                  sizeDiff > 0 ? 'text-git-added' : sizeDiff < 0 ? 'text-git-removed' : 'text-text-muted'
                }`}
              >
                {sizeDiff > 0 ? `+${formatSizeGitHub(sizeDiff)}` : `-${formatSizeGitHub(Math.abs(sizeDiff))}`}{' '}
                ({percentChange}%)
              </span>
            </div>
          </div>
        )}

        {/* 2. SWIPE SPLIT SLIDER MODE */}
        {viewMode === 'swipe' && hasBoth && (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex items-center justify-between w-full max-w-[440px] text-xs font-bold font-mono uppercase px-1">
              <span className="text-git-removed">Deleted</span>
              <span className="text-git-added">Added</span>
            </div>

            <div
              ref={swipeBoxRef}
              onMouseDown={handleStartSwipe}
              className="relative w-[380px] h-[380px] md:w-[440px] md:h-[440px] bg-base-1 border border-border rounded-sm flex items-center justify-center overflow-hidden shadow-sm cursor-ew-resize select-none"
            >
              {/* Added Image (Base Layer) */}
              <img
                src={currentUrl}
                alt="Added"
                className="max-w-full max-h-full object-contain select-none pointer-events-none p-3"
              />

              {/* Deleted Image (Clipped Layer) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none p-3 flex items-center justify-center"
                style={{ clipPath: `polygon(0 0, ${swipePos}% 0, ${swipePos}% 100%, 0 100%)` }}
              >
                <img
                  src={previousUrl}
                  alt="Deleted"
                  className="max-w-full max-h-full object-contain select-none pointer-events-none"
                />
              </div>

              {/* Drag Handle Divider */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-commito-coral pointer-events-none shadow-lg -translate-x-1/2 z-10"
                style={{ left: `${swipePos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-commito-coral text-white flex items-center justify-center shadow-md text-[10px] ring-2 ring-base-1 cursor-ew-resize">
                  <Sliders className="w-3 h-3" />
                </div>
              </div>
            </div>

            <div className="mt-1 text-xs font-mono text-text-muted">
              Diff:{' '}
              <span className="font-semibold text-git-added">
                {sizeDiff > 0 ? `+${formatSizeGitHub(sizeDiff)}` : `-${formatSizeGitHub(Math.abs(sizeDiff))}`}{' '}
                ({percentChange}%)
              </span>
            </div>
          </div>
        )}

        {/* 3. ONION SKIN BLEND MODE */}
        {viewMode === 'onion-skin' && hasBoth && (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative w-[380px] h-[380px] md:w-[440px] md:h-[440px] bg-base-1 border border-border rounded-sm flex items-center justify-center overflow-hidden shadow-sm p-3">
              {/* Base Old Image */}
              <img
                src={previousUrl}
                alt="Deleted"
                className="max-w-full max-h-full object-contain select-none"
              />
              {/* Overlay New Image with Opacity */}
              <img
                src={currentUrl}
                alt="Added"
                style={{ opacity: onionSkinOpacity / 100 }}
                className="absolute max-w-full max-h-full object-contain select-none pointer-events-none p-3"
              />
            </div>

            {/* Opacity Scrubber */}
            <div className="flex items-center gap-3 w-80 max-w-full mt-2">
              <span className="text-xs font-bold font-mono text-git-removed">0%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={onionSkinOpacity}
                onChange={(e) => setOnionSkinOpacity(Number(e.target.value))}
                className="w-full accent-commito-coral cursor-pointer"
              />
              <span className="text-xs font-bold font-mono text-git-added">100%</span>
            </div>

            <div className="text-xs font-mono text-text-muted">
              Opacity: <span className="text-text-primary font-bold">{onionSkinOpacity}%</span>
            </div>
          </div>
        )}

        {/* 4. DIFFERENCE BLEND MODE */}
        {viewMode === 'difference' && hasBoth && (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative w-[380px] h-[380px] md:w-[440px] md:h-[440px] bg-black border border-border rounded-sm flex items-center justify-center overflow-hidden shadow-sm p-3">
              {/* Difference Blend View */}
              <img
                src={previousUrl}
                alt="Deleted"
                className="max-w-full max-h-full object-contain select-none"
              />
              <img
                src={currentUrl}
                alt="Added"
                style={{ mixBlendMode: 'difference' }}
                className="absolute max-w-full max-h-full object-contain select-none p-3"
              />
            </div>

            <div className="mt-1 text-xs font-mono text-text-muted">
              Changed pixels appear in color • Unchanged pixels appear black
            </div>
          </div>
        )}

        {/* 5. SINGLE IMAGE MODE (When file is only Added or only Deleted) */}
        {!hasBoth && (
          <div className="flex flex-col items-center justify-center gap-3">
            <span
              className={`text-xs font-bold font-mono tracking-wider uppercase mb-1 ${
                data?.is_deleted ? 'text-git-removed' : 'text-git-added'
              }`}
            >
              {data?.is_deleted ? 'Deleted' : 'Added'}
            </span>

            <div
              className={`w-[380px] h-[380px] md:w-[440px] md:h-[440px] bg-base-1 border rounded-sm flex items-center justify-center p-3 shadow-sm overflow-hidden ${
                data?.is_deleted ? 'border-git-removed/70' : 'border-git-added/70'
              }`}
            >
              <img
                src={currentUrl || previousUrl}
                alt={filePath}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setCurrDims({ width: img.naturalWidth, height: img.naturalHeight });
                }}
                className="max-w-full max-h-full object-contain drop-shadow-sm"
              />
            </div>

            <div className="mt-2 text-xs font-mono text-text-muted text-center">
              W: {currDims?.width || '—'}px | H: {currDims?.height || '—'}px | Size:{' '}
              {formatSizeGitHub(data?.current_size_bytes || data?.previous_size_bytes || 0)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
