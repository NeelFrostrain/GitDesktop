import React from 'react';
import { CommitGraphNode, LANE_COLORS } from './gitGraphLayout';

interface GitGraphLaneProps {
  node?: CommitGraphNode;
  rowHeight?: number;
  isSelected?: boolean;
}

const LANE_WIDTH = 13;
const NODE_RADIUS = 3.5;
const MERGE_RADIUS = 4;
const PADDING_LEFT = 8;

export const GitGraphLane: React.FC<GitGraphLaneProps> = ({
  node,
  rowHeight = 56,
  isSelected = false,
}) => {
  if (!node) {
    return <div className="w-4 shrink-0" />;
  }

  const { lane, colorIndex, isHead, isMerge, outSegments, activeLanes } = node;
  const nodeX = PADDING_LEFT + lane * LANE_WIDTH;
  const centerY = rowHeight / 2;
  const nodeColor = LANE_COLORS[colorIndex] || LANE_COLORS[0];

  // Calculate required width
  const maxLane = Math.max(lane, ...(activeLanes || [0]), ...outSegments.map((s) => s.toLane));
  const svgWidth = Math.max(22, PADDING_LEFT + (maxLane + 1) * LANE_WIDTH);

  return (
    <div className="shrink-0 self-stretch flex items-center justify-center pointer-events-none select-none">
      <svg
        width={svgWidth}
        height={rowHeight}
        className="overflow-visible"
        style={{ minWidth: `${svgWidth}px` }}
      >
        {/* 1. Passing continuous lines (lanes running through without a commit node here) */}
        {activeLanes.map((lIdx) => {
          const x = PADDING_LEFT + lIdx * LANE_WIDTH;
          const color = LANE_COLORS[lIdx % LANE_COLORS.length];
          return (
            <line
              key={`pass-${lIdx}`}
              x1={x}
              y1={0}
              x2={x}
              y2={rowHeight}
              stroke={color}
              strokeWidth={1.75}
              strokeOpacity={0.65}
            />
          );
        })}

        {/* 2. Incoming top line into current node */}
        <line
          x1={nodeX}
          y1={0}
          x2={nodeX}
          y2={centerY}
          stroke={nodeColor}
          strokeWidth={2}
          strokeOpacity={0.85}
        />

        {/* 3. Outgoing bottom lines to parent commits */}
        {outSegments.map((seg, sIdx) => {
          const fromX = nodeX;
          const toX = PADDING_LEFT + seg.toLane * LANE_WIDTH;
          const segColor = LANE_COLORS[seg.colorIndex % LANE_COLORS.length] || nodeColor;

          if (fromX === toX) {
            return (
              <line
                key={`out-${sIdx}`}
                x1={fromX}
                y1={centerY}
                x2={toX}
                y2={rowHeight}
                stroke={segColor}
                strokeWidth={2}
                strokeOpacity={0.85}
              />
            );
          }

          // Curved bezier line for branch fork or merge
          const midY = (centerY + rowHeight) / 2;
          const pathData = `M ${fromX} ${centerY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${rowHeight}`;
          return (
            <path
              key={`curve-${sIdx}`}
              d={pathData}
              fill="none"
              stroke={segColor}
              strokeWidth={1.75}
              strokeOpacity={0.75}
            />
          );
        })}

        {/* 4. Commit Node Dot */}
        {isMerge ? (
          // Diamond / Double ring for Merge commit
          <g>
            <circle
              cx={nodeX}
              cy={centerY}
              r={MERGE_RADIUS + 1.5}
              fill="none"
              stroke={nodeColor}
              strokeWidth={1.5}
              strokeOpacity={0.5}
            />
            <circle
              cx={nodeX}
              cy={centerY}
              r={MERGE_RADIUS}
              fill={isSelected ? '#ffffff' : nodeColor}
              stroke="#111113"
              strokeWidth={1.5}
            />
          </g>
        ) : (
          // Solid node circle for standard commit
          <g>
            {isHead && (
              <circle
                cx={nodeX}
                cy={centerY}
                r={NODE_RADIUS + 2.5}
                fill={nodeColor}
                fillOpacity={0.25}
                className="animate-pulse"
              />
            )}
            <circle
              cx={nodeX}
              cy={centerY}
              r={NODE_RADIUS}
              fill={isSelected ? '#ffffff' : nodeColor}
              stroke="#111113"
              strokeWidth={1.5}
            />
          </g>
        )}
      </svg>
    </div>
  );
};
