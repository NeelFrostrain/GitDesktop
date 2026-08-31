import React from 'react';
import { CommitGraphNode, LANE_COLORS } from './gitGraphLayout';

interface GitGraphLaneProps {
  node?: CommitGraphNode;
  rowHeight?: number;
  isSelected?: boolean;
}

const LANE_WIDTH = 12;
const NODE_RADIUS = 3.5;
const MERGE_RADIUS = 4;
const PADDING_LEFT = 10;

export const GitGraphLane: React.FC<GitGraphLaneProps> = ({
  node,
  rowHeight = 44,
  isSelected = false,
}) => {
  if (!node) {
    return <div className="w-4 shrink-0" />;
  }

  const { lane, colorIndex, isHead, isMerge, inSegments, outSegments, activeLanes } = node;
  const nodeX = PADDING_LEFT + lane * LANE_WIDTH;
  const centerY = rowHeight / 2;
  const nodeColor = LANE_COLORS[colorIndex % LANE_COLORS.length] || LANE_COLORS[0];

  // Calculate required width
  const maxLane = Math.max(
    lane,
    ...(activeLanes || [0]),
    ...(inSegments || []).map((s) => s.fromLane),
    ...(outSegments || []).map((s) => s.toLane)
  );
  const svgWidth = Math.max(22, PADDING_LEFT + (maxLane + 1) * LANE_WIDTH + 4);

  return (
    <div
      className="shrink-0 flex items-center justify-center pointer-events-none select-none h-full"
      style={{ width: `${svgWidth}px`, height: `${rowHeight}px` }}
    >
      <svg
        width={svgWidth}
        height={rowHeight}
        viewBox={`0 0 ${svgWidth} ${rowHeight}`}
        className="block overflow-visible"
        style={{ width: `${svgWidth}px`, height: `${rowHeight}px` }}
      >
        {/* 1. Passing continuous vertical lines through this row */}
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
              strokeWidth={2}
              strokeOpacity={0.7}
            />
          );
        })}

        {/* 2. Incoming lines from above entering this commit node */}
        {(inSegments || []).map((inSeg, inIdx) => {
          const fromX = PADDING_LEFT + inSeg.fromLane * LANE_WIDTH;
          const toX = nodeX;
          const segColor = LANE_COLORS[inSeg.colorIndex % LANE_COLORS.length] || nodeColor;

          if (fromX === toX) {
            return (
              <line
                key={`in-${inIdx}`}
                x1={fromX}
                y1={0}
                x2={toX}
                y2={centerY}
                stroke={segColor}
                strokeWidth={2}
                strokeOpacity={0.9}
              />
            );
          }

          // Curved incoming merge from another branch above
          const midY = centerY / 2;
          const pathData = `M ${fromX} 0 C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${centerY}`;
          return (
            <path
              key={`in-curve-${inIdx}`}
              d={pathData}
              fill="none"
              stroke={segColor}
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          );
        })}

        {/* 3. Outgoing bottom lines to parent commits */}
        {(outSegments || []).map((seg, sIdx) => {
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
                strokeOpacity={0.9}
              />
            );
          }

          // Smooth cubic bezier curve for branch fork / merge connection
          const midY = (centerY + rowHeight) / 2;
          const pathData = `M ${fromX} ${centerY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${rowHeight}`;
          return (
            <path
              key={`curve-${sIdx}`}
              d={pathData}
              fill="none"
              stroke={segColor}
              strokeWidth={2}
              strokeOpacity={0.85}
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
              strokeOpacity={0.6}
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
                r={NODE_RADIUS + 3}
                fill={nodeColor}
                fillOpacity={0.3}
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
