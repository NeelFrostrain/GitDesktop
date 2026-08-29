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
  hasIncoming: boolean;        // Whether there is a child commit connecting from above
  outSegments: GraphSegment[]; // Lines leaving to bottom (toward older commits)
  activeLanes: number[];       // All lanes passing straight through this row from above
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
];

/**
 * Computes topological graph layout metadata for a sequence of commits.
 */
export function computeGitGraphLayout(commits: CommitInfo[]): Map<string, CommitGraphNode> {
  const result = new Map<string, CommitGraphNode>();
  if (!commits || commits.length === 0) return result;

  // Track active branch lanes: each lane holds the expected next commit SHA
  const activeLanes: (string | null)[] = [];

  const getLaneForSha = (sha: string): number => {
    let index = activeLanes.indexOf(sha);
    if (index === -1) {
      // Find first empty slot or append
      index = activeLanes.indexOf(null);
      if (index === -1) {
        index = activeLanes.length;
        activeLanes.push(sha);
      } else {
        activeLanes[index] = sha;
      }
    }
    return index;
  };

  commits.forEach((commit, idx) => {
    const parents = commit.parent_shas || [];
    const isMerge = parents.length > 1;
    const isHead = idx === 0;

    // Check if a newer commit above already allocated a lane for this commit
    const existingLane = activeLanes.indexOf(commit.sha);
    const hasIncoming = existingLane !== -1;

    let lane = existingLane;
    if (lane === -1) {
      lane = getLaneForSha(commit.sha);
    }

    const colorIndex = lane % LANE_COLORS.length;

    // 1. Capture passing lanes entering this row from ABOVE before allocating new parent lanes
    const passingLanes = activeLanes
      .map((target, lIdx) => (target !== null && lIdx !== lane ? lIdx : -1))
      .filter((l) => l !== -1);

    // Free current commit from its lane
    activeLanes[lane] = null;

    // Outgoing segments
    const outSegments: GraphSegment[] = [];

    // Allocate lanes for parents
    if (parents.length > 0) {
      // First parent inherits current lane
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
        colorIndex: lane % LANE_COLORS.length,
      });

      // Subsequent parents (merges from other branches)
      for (let p = 1; p < parents.length; p++) {
        const otherParent = parents[p];
        const otherLane = getLaneForSha(otherParent);
        outSegments.push({
          fromLane: lane,
          toLane: otherLane,
          type: 'merge-in',
          colorIndex: otherLane % LANE_COLORS.length,
        });
      }
    }

    result.set(commit.sha, {
      commitSha: commit.sha,
      lane,
      colorIndex,
      isHead,
      isMerge,
      hasIncoming,
      outSegments,
      activeLanes: passingLanes,
    });
  });

  return result;
}
