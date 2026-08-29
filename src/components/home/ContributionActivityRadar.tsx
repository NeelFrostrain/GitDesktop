import React, { useState } from 'react';
import { GitCommit, GitPullRequest, AlertCircle, Eye, Activity } from 'lucide-react';
import { useContributionsStore } from '../../store/contributionsStore';

export const ContributionActivityRadar: React.FC = () => {
  const calendar = useContributionsStore((s) => s.calendar);
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  const breakdown = calendar?.breakdown || {
    commits_count: calendar?.total_contributions || 0,
    prs_count: 0,
    reviews_count: 0,
    issues_count: 0,
    commits_pct: calendar && calendar.total_contributions > 0 ? 93 : 0,
    prs_pct: calendar && calendar.total_contributions > 0 ? 6 : 0,
    reviews_pct: 0,
    issues_pct: calendar && calendar.total_contributions > 0 ? 1 : 0,
  };

  const cx = 110;
  const cy = 105;
  const maxRadius = 68;

  // Calculate coordinates for 4 axes (Top = Code review, Right = Issues, Bottom = Pull requests, Left = Commits)
  const topDistance = (Math.max(breakdown.reviews_pct, 4) / 100) * maxRadius;
  const rightDistance = (Math.max(breakdown.issues_pct, 4) / 100) * maxRadius;
  const bottomDistance = (Math.max(breakdown.prs_pct, 4) / 100) * maxRadius;
  const leftDistance = (Math.max(breakdown.commits_pct, 4) / 100) * maxRadius;

  const topPoint = { x: cx, y: cy - topDistance };
  const rightPoint = { x: cx + rightDistance, y: cy };
  const bottomPoint = { x: cx, y: cy + bottomDistance };
  const leftPoint = { x: cx - leftDistance, y: cy };

  const polygonPoints = `${topPoint.x},${topPoint.y} ${rightPoint.x},${rightPoint.y} ${bottomPoint.x},${bottomPoint.y} ${leftPoint.x},${leftPoint.y}`;

  return (
    <div className="flex flex-col p-3.5 bg-base-1/50 border border-border rounded-sm select-none font-sans relative shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-text-primary tracking-tight">
            Activity Overview
          </span>
        </div>
        <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded-xs bg-base-1 border border-border transition-all duration-150 max-w-[160px] truncate">
          {hoveredAxis
            ? hoveredAxis === 'Commits'
              ? `${breakdown.commits_count} commits (${breakdown.commits_pct}%)`
              : hoveredAxis === 'Pull requests'
                ? `${breakdown.prs_count} PRs (${breakdown.prs_pct}%)`
                : hoveredAxis === 'Issues'
                  ? `${breakdown.issues_count} issues (${breakdown.issues_pct}%)`
                  : `${breakdown.reviews_count} reviews (${breakdown.reviews_pct}%)`
            : 'Overview'}
        </span>
      </div>

      {/* 4-Axis Interactive Chart with Concentric Web Grid */}
      <div className="relative w-full h-[195px] flex items-center justify-center my-0.5">
        <svg viewBox="0 0 220 210" className="w-full h-full overflow-visible max-w-[220px]">
          {/* Subtle concentric background webs */}
          {[0.25, 0.5, 0.75, 1.0].map((scale, i) => (
            <polygon
              key={scale}
              points={`${cx},${cy - maxRadius * scale} ${cx + maxRadius * scale},${cy} ${cx},${cy + maxRadius * scale} ${cx - maxRadius * scale},${cy}`}
              fill="none"
              stroke="currentColor"
              className={i === 3 ? 'text-border-strong' : 'text-border/60'}
              strokeWidth="1"
              strokeDasharray={i === 3 ? undefined : '2 2'}
            />
          ))}

          {/* Axis Crosshair Lines */}
          <line
            x1={cx}
            y1={cy - maxRadius - 6}
            x2={cx}
            y2={cy + maxRadius + 6}
            stroke="currentColor"
            className="text-border-strong"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <line
            x1={cx - maxRadius - 6}
            y1={cy}
            x2={cx + maxRadius + 6}
            y2={cy}
            stroke="currentColor"
            className="text-border-strong"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Radar Shape Fill Polygon */}
          <polygon
            points={polygonPoints}
            fill="rgba(34, 197, 94, 0.25)"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinejoin="round"
            className="transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(34,197,94,0.35)]"
          />

          {/* Vertex Node Circles (Top: Code review) */}
          <g
            onMouseEnter={() => setHoveredAxis('Code review')}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle cx={topPoint.x} cy={topPoint.y} r="14" fill="transparent" />
            {hoveredAxis === 'Code review' && (
              <circle
                cx={topPoint.x}
                cy={topPoint.y}
                r="7"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                opacity="0.6"
                className="pointer-events-none"
              />
            )}
            <circle
              cx={topPoint.x}
              cy={topPoint.y}
              r={hoveredAxis === 'Code review' ? 4.5 : 3.5}
              fill={hoveredAxis === 'Code review' ? '#22c55e' : '#1e1e1e'}
              stroke="#22c55e"
              strokeWidth={hoveredAxis === 'Code review' ? 2 : 1.5}
              className="pointer-events-none transition-all duration-150"
            />
          </g>

          {/* Vertex Node Circles (Right: Issues) */}
          <g
            onMouseEnter={() => setHoveredAxis('Issues')}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle cx={rightPoint.x} cy={rightPoint.y} r="14" fill="transparent" />
            {hoveredAxis === 'Issues' && (
              <circle
                cx={rightPoint.x}
                cy={rightPoint.y}
                r="7"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                opacity="0.6"
                className="pointer-events-none"
              />
            )}
            <circle
              cx={rightPoint.x}
              cy={rightPoint.y}
              r={hoveredAxis === 'Issues' ? 4.5 : 3.5}
              fill={hoveredAxis === 'Issues' ? '#22c55e' : '#1e1e1e'}
              stroke="#22c55e"
              strokeWidth={hoveredAxis === 'Issues' ? 2 : 1.5}
              className="pointer-events-none transition-all duration-150"
            />
          </g>

          {/* Vertex Node Circles (Bottom: Pull requests) */}
          <g
            onMouseEnter={() => setHoveredAxis('Pull requests')}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle cx={bottomPoint.x} cy={bottomPoint.y} r="14" fill="transparent" />
            {hoveredAxis === 'Pull requests' && (
              <circle
                cx={bottomPoint.x}
                cy={bottomPoint.y}
                r="7"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                opacity="0.6"
                className="pointer-events-none"
              />
            )}
            <circle
              cx={bottomPoint.x}
              cy={bottomPoint.y}
              r={hoveredAxis === 'Pull requests' ? 4.5 : 3.5}
              fill={hoveredAxis === 'Pull requests' ? '#22c55e' : '#1e1e1e'}
              stroke="#22c55e"
              strokeWidth={hoveredAxis === 'Pull requests' ? 2 : 1.5}
              className="pointer-events-none transition-all duration-150"
            />
          </g>

          {/* Vertex Node Circles (Left: Commits) */}
          <g
            onMouseEnter={() => setHoveredAxis('Commits')}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle cx={leftPoint.x} cy={leftPoint.y} r="14" fill="transparent" />
            {hoveredAxis === 'Commits' && (
              <circle
                cx={leftPoint.x}
                cy={leftPoint.y}
                r="7"
                fill="none"
                stroke="#22c55e"
                strokeWidth="1.5"
                opacity="0.6"
                className="pointer-events-none"
              />
            )}
            <circle
              cx={leftPoint.x}
              cy={leftPoint.y}
              r={hoveredAxis === 'Commits' ? 4.5 : 3.5}
              fill={hoveredAxis === 'Commits' ? '#22c55e' : '#1e1e1e'}
              stroke="#22c55e"
              strokeWidth={hoveredAxis === 'Commits' ? 2 : 1.5}
              className="pointer-events-none transition-all duration-150"
            />
          </g>
        </svg>

        {/* Axis Labels */}
        {/* Top: Code review */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 text-center select-none cursor-pointer group"
          onMouseEnter={() => setHoveredAxis('Code review')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[10px] text-text-muted font-medium group-hover:text-text-primary transition-colors">
            Code review{' '}
            {breakdown.reviews_pct > 0 && (
              <span className="font-semibold text-text-primary">({breakdown.reviews_pct}%)</span>
            )}
          </p>
        </div>

        {/* Right: Issues */}
        <div
          className="absolute right-0.5 top-1/2 -translate-y-1/2 text-left pl-1 select-none cursor-pointer group"
          onMouseEnter={() => setHoveredAxis('Issues')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[10px] text-text-muted font-medium group-hover:text-text-primary transition-colors">
            Issues{' '}
            {breakdown.issues_pct > 0 && (
              <span className="font-semibold text-text-primary">({breakdown.issues_pct}%)</span>
            )}
          </p>
        </div>

        {/* Bottom: Pull requests */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center select-none cursor-pointer group"
          onMouseEnter={() => setHoveredAxis('Pull requests')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[10px] text-text-muted font-medium group-hover:text-text-primary transition-colors">
            Pull requests{' '}
            {breakdown.prs_pct > 0 && (
              <span className="font-semibold text-text-primary">({breakdown.prs_pct}%)</span>
            )}
          </p>
        </div>

        {/* Left: Commits */}
        <div
          className="absolute left-0.5 top-1/2 -translate-y-1/2 text-right pr-1 select-none cursor-pointer group"
          onMouseEnter={() => setHoveredAxis('Commits')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[10px] text-text-muted font-medium group-hover:text-text-primary transition-colors">
            Commits{' '}
            {breakdown.commits_pct > 0 && (
              <span className="font-semibold text-text-primary">({breakdown.commits_pct}%)</span>
            )}
          </p>
        </div>
      </div>

      {/* Breakdown Stat Pills Footer */}
      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/60 text-[10.5px]">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-1 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === 'Commits'
              ? 'border-commito-coral/50 bg-commito-coral/5'
              : 'border-border hover:border-border-strong'
          }`}
          onMouseEnter={() => setHoveredAxis('Commits')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <GitCommit className="w-3 h-3 text-commito-coral shrink-0" />
          <span className="text-text-muted text-[10px]">Commits:</span>
          <span className="font-semibold text-text-primary ml-auto font-mono text-[10.5px]">
            {breakdown.commits_pct}%
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-1 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === 'Pull requests'
              ? 'border-purple-400/50 bg-purple-500/5'
              : 'border-border hover:border-border-strong'
          }`}
          onMouseEnter={() => setHoveredAxis('Pull requests')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <GitPullRequest className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="text-text-muted text-[10px]">PRs:</span>
          <span className="font-semibold text-text-primary ml-auto font-mono text-[10.5px]">
            {breakdown.prs_pct}%
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-1 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === 'Issues'
              ? 'border-emerald-400/50 bg-emerald-500/5'
              : 'border-border hover:border-border-strong'
          }`}
          onMouseEnter={() => setHoveredAxis('Issues')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <AlertCircle className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-text-muted text-[10px]">Issues:</span>
          <span className="font-semibold text-text-primary ml-auto font-mono text-[10.5px]">
            {breakdown.issues_pct}%
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-1 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === 'Code review'
              ? 'border-blue-400/50 bg-blue-500/5'
              : 'border-border hover:border-border-strong'
          }`}
          onMouseEnter={() => setHoveredAxis('Code review')}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <Eye className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-text-muted text-[10px]">Reviews:</span>
          <span className="font-semibold text-text-primary ml-auto font-mono text-[10.5px]">
            {breakdown.reviews_pct}%
          </span>
        </div>
      </div>
    </div>
  );
};
