import React, { useState } from "react";
import { GitCommit, GitPullRequest, AlertCircle, Eye } from "lucide-react";
import { useContributionsStore } from "../../store/contributionsStore";

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
  const cy = 110;
  const maxRadius = 75;

  // Calculate coordinates for 4 axes (Top = Code review, Right = Issues, Bottom = Pull requests, Left = Commits)
  const topDistance = (Math.max(breakdown.reviews_pct, 2) / 100) * maxRadius;
  const rightDistance = (Math.max(breakdown.issues_pct, 2) / 100) * maxRadius;
  const bottomDistance = (Math.max(breakdown.prs_pct, 2) / 100) * maxRadius;
  const leftDistance = (Math.max(breakdown.commits_pct, 2) / 100) * maxRadius;

  const topPoint = { x: cx, y: cy - topDistance };
  const rightPoint = { x: cx + rightDistance, y: cy };
  const bottomPoint = { x: cx, y: cy + bottomDistance };
  const leftPoint = { x: cx - leftDistance, y: cy };

  const polygonPoints = `${topPoint.x},${topPoint.y} ${rightPoint.x},${rightPoint.y} ${bottomPoint.x},${bottomPoint.y} ${leftPoint.x},${leftPoint.y}`;

  return (
    <div className="flex flex-col p-3 bg-surface-subtle/80 border border-border/70 rounded-sm select-none font-sans relative">
      {/* Header — badge shows live info when hovering an axis */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-1 min-h-[22px]">
        <span className="text-xs font-semibold text-text-primary tracking-tight">
          Activity Overview
        </span>
        <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded-xs bg-base-0 border border-border transition-all duration-150 max-w-[160px] truncate">
          {hoveredAxis
            ? hoveredAxis === "Commits"
              ? `${breakdown.commits_count} commits (${breakdown.commits_pct}%)`
              : hoveredAxis === "Pull requests"
                ? `${breakdown.prs_count} PRs (${breakdown.prs_pct}%)`
                : hoveredAxis === "Issues"
                  ? `${breakdown.issues_count} issues (${breakdown.issues_pct}%)`
                  : `${breakdown.reviews_count} reviews (${breakdown.reviews_pct}%)`
            : "Breakdown"}
        </span>
      </div>

      {/* 4-Axis Interactive Crosshair Chart */}
      <div className="relative w-full h-[230px] flex items-center justify-center my-1">
        <svg
          viewBox="0 0 220 220"
          className="w-full h-full overflow-visible max-w-[220px]"
        >
          {/* Axis Crosshair Lines */}
          <line
            x1={cx}
            y1={cy - maxRadius - 10}
            x2={cx}
            y2={cy + maxRadius + 10}
            stroke="#26a641"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1={cx - maxRadius - 10}
            y1={cy}
            x2={cx + maxRadius + 10}
            y2={cy}
            stroke="#26a641"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Radar Shape Fill Polygon */}
          <polygon
            points={polygonPoints}
            fill="rgba(38, 166, 65, 0.35)"
            stroke="#39d353"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(57,211,83,0.4)]"
          />

          {/* Vertex Node Circles - large hit area prevents hover flicker */}
          <g
            onMouseEnter={() => setHoveredAxis("Code review")}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle cx={topPoint.x} cy={topPoint.y} r="10" fill="transparent" />
            <circle
              cx={topPoint.x}
              cy={topPoint.y}
              r="3.5"
              fill="#ffffff"
              stroke="#26a641"
              strokeWidth="1.5"
              className="pointer-events-none"
            />
          </g>
          <g
            onMouseEnter={() => setHoveredAxis("Issues")}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle
              cx={rightPoint.x}
              cy={rightPoint.y}
              r="10"
              fill="transparent"
            />
            <circle
              cx={rightPoint.x}
              cy={rightPoint.y}
              r="3.5"
              fill="#ffffff"
              stroke="#26a641"
              strokeWidth="1.5"
              className="pointer-events-none"
            />
          </g>
          <g
            onMouseEnter={() => setHoveredAxis("Pull requests")}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle
              cx={bottomPoint.x}
              cy={bottomPoint.y}
              r="10"
              fill="transparent"
            />
            <circle
              cx={bottomPoint.x}
              cy={bottomPoint.y}
              r="3.5"
              fill="#ffffff"
              stroke="#26a641"
              strokeWidth="1.5"
              className="pointer-events-none"
            />
          </g>
          <g
            onMouseEnter={() => setHoveredAxis("Commits")}
            onMouseLeave={() => setHoveredAxis(null)}
            className="cursor-pointer"
          >
            <circle
              cx={leftPoint.x}
              cy={leftPoint.y}
              r="10"
              fill="transparent"
            />
            <circle
              cx={leftPoint.x}
              cy={leftPoint.y}
              r="3.5"
              fill="#ffffff"
              stroke="#26a641"
              strokeWidth="1.5"
              className="pointer-events-none"
            />
          </g>
        </svg>

        {/* Axis Labels */}
        {/* Top: Code review */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 text-center select-none cursor-pointer"
          onMouseEnter={() => setHoveredAxis("Code review")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          {breakdown.reviews_pct > 0 && (
            <p className="text-[11px] font-semibold text-text-primary leading-tight">
              {breakdown.reviews_pct}%
            </p>
          )}
          <p className="text-[10px] text-text-muted font-medium">Code review</p>
        </div>

        {/* Right: Issues */}
        <div
          className="absolute right-1 top-1/2 -translate-y-1/2 text-left pl-1 select-none cursor-pointer"
          onMouseEnter={() => setHoveredAxis("Issues")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[11px] font-semibold text-text-primary leading-tight">
            {breakdown.issues_pct}%
          </p>
          <p className="text-[10px] text-text-muted font-medium">Issues</p>
        </div>

        {/* Bottom: Pull requests */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center select-none cursor-pointer"
          onMouseEnter={() => setHoveredAxis("Pull requests")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[11px] font-semibold text-text-primary leading-tight">
            {breakdown.prs_pct}%
          </p>
          <p className="text-[10px] text-text-muted font-medium">
            Pull requests
          </p>
        </div>

        {/* Left: Commits */}
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 text-right pr-1 select-none cursor-pointer"
          onMouseEnter={() => setHoveredAxis("Commits")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <p className="text-[11px] font-semibold text-text-primary leading-tight">
            {breakdown.commits_pct}%
          </p>
          <p className="text-[10px] text-text-muted font-medium">Commits</p>
        </div>
      </div>

      {/* Breakdown Stat Pills Footer */}
      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/50 text-[10.5px]">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-0/80 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === "Commits"
              ? "border-commito-coral/50 bg-commito-coral/5"
              : "border-border"
          }`}
          onMouseEnter={() => setHoveredAxis("Commits")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <GitCommit className="w-3 h-3 text-commito-coral shrink-0" />
          <span className="text-text-muted truncate">Commits:</span>
          <span className="font-semibold text-text-primary ml-auto">
            {breakdown.commits_pct}%
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-0/80 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === "Pull requests"
              ? "border-purple-400/50 bg-purple-500/5"
              : "border-border"
          }`}
          onMouseEnter={() => setHoveredAxis("Pull requests")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <GitPullRequest className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="text-text-muted truncate">PRs:</span>
          <span className="font-semibold text-text-primary ml-auto">
            {breakdown.prs_pct}%
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-0/80 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === "Issues"
              ? "border-emerald-400/50 bg-emerald-500/5"
              : "border-border"
          }`}
          onMouseEnter={() => setHoveredAxis("Issues")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <AlertCircle className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-text-muted truncate">Issues:</span>
          <span className="font-semibold text-text-primary ml-auto">
            {breakdown.issues_pct}%
          </span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 bg-base-0/80 border rounded-xs transition-colors cursor-pointer ${
            hoveredAxis === "Code review"
              ? "border-blue-400/50 bg-blue-500/5"
              : "border-border"
          }`}
          onMouseEnter={() => setHoveredAxis("Code review")}
          onMouseLeave={() => setHoveredAxis(null)}
        >
          <Eye className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-text-muted truncate">Reviews:</span>
          <span className="font-semibold text-text-primary ml-auto">
            {breakdown.reviews_pct}%
          </span>
        </div>
      </div>
    </div>
  );
};
