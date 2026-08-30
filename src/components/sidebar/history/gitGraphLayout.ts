import { CommitInfo } from '../../../types/git';

export interface GraphSegment {
  fromLane: number;
  toLane: number;
  type: 'straight' | 'merge-in' | 'fork-out';
  colorIndex: number;
}

export interface CommitGraphNode {
  commitSha: string;
  lane: number;
  colorIndex: number;
  isHead: boolean;
  isMerge: boolean;
  hasIncoming: boolean; // Whether there is at least one incoming line from above
  inSegments: GraphSegment[]; // Incoming curves/lines entering into this commit from above
  outSegments: GraphSegment[]; // Outgoing curves/lines leaving to bottom (toward older commits)
  activeLanes: number[]; // All lanes passing straight through this row from above
}

export const LANE_COLORS = [
  '#3b82f6', // Bright Blue
  '#ec4899', // Magenta / Pink
  '#10b981', // Emerald Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#e11d48', // Rose
  '#6366f1', // Indigo
];

/**
 * Computes topological railway graph layout metadata for a sequence of commits.
 * Robustly handles branch forks, merges, multiple incoming paths, and passing lanes.
 */
export function computeGitGraphLayout(commits: CommitInfo[]): Map<string, CommitGraphNode> {
  const result = new Map<string, CommitGraphNode>();
  if (!commits || commits.length === 0) return result;

  // Track active branch lanes: each lane index holds the expected next commit SHA
  const activeLanes: (string | null)[] = [];

  const getFreeLane = (sha: string): number => {
    let index = activeLanes.indexOf(null);
    if (index === -1) {
      index = activeLanes.length;
      activeLanes.push(sha);
    } else {
      activeLanes[index] = sha;
    }
    return index;
  };

  commits.forEach((commit, idx) => {
    const parents = commit.parent_shas || [];
    const isMerge = parents.length > 1;
    const isHead = idx === 0;

    // 1. Single-pass identification of matching and passing lanes
    const matchingLanes: number[] = [];
    const passingLanes: number[] = [];

    for (let lIdx = 0; lIdx < activeLanes.length; lIdx++) {
      const targetSha = activeLanes[lIdx];
      if (targetSha === commit.sha) {
        matchingLanes.push(lIdx);
      } else if (targetSha !== null) {
        passingLanes.push(lIdx);
      }
    }

    let lane: number;
    const inSegments: GraphSegment[] = [];

    if (matchingLanes.length > 0) {
      // Primary lane is the leftmost matching lane
      lane = matchingLanes[0];

      // Primary straight incoming segment from above
      inSegments.push({
        fromLane: lane,
        toLane: lane,
        type: 'straight',
        colorIndex: lane % LANE_COLORS.length,
      });

      // Converging incoming curves from other branches that point to this same commit
      for (let m = 1; m < matchingLanes.length; m++) {
        const extraLane = matchingLanes[m];
        inSegments.push({
          fromLane: extraLane,
          toLane: lane,
          type: 'merge-in',
          colorIndex: extraLane % LANE_COLORS.length,
        });
      }
    } else {
      // Branch tip / HEAD commit that had no incoming line from above
      lane = getFreeLane(commit.sha);
    }

    const hasIncoming = matchingLanes.length > 0;
    const colorIndex = lane % LANE_COLORS.length;

    // 2. Clear all matching lanes now that we have reached this commit
    if (matchingLanes.length > 0) {
      for (let i = 0; i < matchingLanes.length; i++) {
        activeLanes[matchingLanes[i]] = null;
      }
    } else {
      activeLanes[lane] = null;
    }

    // 4. Outgoing segments leaving toward parent commits
    const outSegments: GraphSegment[] = [];

    if (parents.length > 0) {
      // First parent (main branch continuation)
      const firstParent = parents[0];
      let firstParentLane = activeLanes.indexOf(firstParent);
      if (firstParentLane === -1) {
        activeLanes[lane] = firstParent;
        firstParentLane = lane;
      }

      outSegments.push({
        fromLane: lane,
        toLane: firstParentLane,
        type: lane === firstParentLane ? 'straight' : 'merge-in',
        colorIndex: (lane === firstParentLane ? lane : firstParentLane) % LANE_COLORS.length,
      });

      // Subsequent parents (merge commits)
      for (let p = 1; p < parents.length; p++) {
        const otherParent = parents[p];
        let otherLane = activeLanes.indexOf(otherParent);
        if (otherLane === -1) {
          otherLane = getFreeLane(otherParent);
        }

        outSegments.push({
          fromLane: lane,
          toLane: otherLane,
          type: 'fork-out',
          colorIndex: otherLane % LANE_COLORS.length,
        });
      }
    }

    // 5. Trim trailing nulls to keep lane indices tight
    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop();
    }

    result.set(commit.sha, {
      commitSha: commit.sha,
      lane,
      colorIndex,
      isHead,
      isMerge,
      hasIncoming,
      inSegments,
      outSegments,
      activeLanes: passingLanes,
    });
  });

  return result;
}
