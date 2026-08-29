import { CommitInfo } from '../../../types/git';

export interface GraphPoint {
  x: number;
  y: number;
}

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
  inSegments: GraphSegment[];  // Lines entering from top (newer commits)
  outSegments: GraphSegment[]; // Lines leaving to bottom (older commits)
  activeLanes: number[];       // All lanes passing through this row
}

export const LANE_COLORS = [
  '#e05638', // Commito Coral
  '#60a5fa', // Blue
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#c084fc', // Purple
  '#38bdf8', // Sky
  '#f472b6', // Pink
];

/**
 * Computes graph layout metadata for a slice of commits.
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

    // Determine this commit's lane
    let lane = activeLanes.indexOf(commit.sha);
    if (lane === -1) {
      lane = getLaneForSha(commit.sha);
    }

    const colorIndex = lane % LANE_COLORS.length;

    // Outgoing segments
    const outSegments: GraphSegment[] = [];

    // Free current commit from its lane
    activeLanes[lane] = null;

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

      // Subsequent parents (merges)
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

    // Capture snapshot of currently passing active lanes
    const passingLanes = activeLanes
      .map((target, lIdx) => (target !== null && lIdx !== lane ? lIdx : -1))
      .filter((l) => l !== -1);

    result.set(commit.sha, {
      commitSha: commit.sha,
      lane,
      colorIndex,
      isHead,
      isMerge,
      inSegments: [],
      outSegments,
      activeLanes: passingLanes,
    });
  });

  return result;
}
