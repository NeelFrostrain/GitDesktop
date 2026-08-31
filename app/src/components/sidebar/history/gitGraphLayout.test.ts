import { describe, it, expect } from 'vitest';
import { computeGitGraphLayout } from './gitGraphLayout';
import { CommitInfo } from '../../../types/git';

describe('computeGitGraphLayout', () => {
  it('handles empty commit array gracefully', () => {
    const res = computeGitGraphLayout([]);
    expect(res.size).toBe(0);
  });

  it('computes linear commit chain with single lane', () => {
    const commits: CommitInfo[] = [
      {
        sha: 'sha3',
        short_sha: 'sha3',
        message: 'Commit 3',
        author_name: 'Alice',
        author_email: 'alice@example.com',
        timestamp: 1003,
        relative_date: 'now',
        parent_shas: ['sha2'],
      },
      {
        sha: 'sha2',
        short_sha: 'sha2',
        message: 'Commit 2',
        author_name: 'Alice',
        author_email: 'alice@example.com',
        timestamp: 1002,
        relative_date: '1m ago',
        parent_shas: ['sha1'],
      },
      {
        sha: 'sha1',
        short_sha: 'sha1',
        message: 'Initial commit',
        author_name: 'Alice',
        author_email: 'alice@example.com',
        timestamp: 1001,
        relative_date: '2m ago',
        parent_shas: [],
      },
    ];

    const nodes = computeGitGraphLayout(commits);
    expect(nodes.size).toBe(3);

    const node3 = nodes.get('sha3')!;
    expect(node3.lane).toBe(0);
    expect(node3.isHead).toBe(true);
    expect(node3.outSegments.length).toBe(1);
    expect(node3.outSegments[0].fromLane).toBe(0);
    expect(node3.outSegments[0].toLane).toBe(0);

    const node2 = nodes.get('sha2')!;
    expect(node2.lane).toBe(0);
    expect(node2.hasIncoming).toBe(true);

    const node1 = nodes.get('sha1')!;
    expect(node1.lane).toBe(0);
    expect(node1.outSegments.length).toBe(0);
  });

  it('computes branch merge with multiple parents and converging curves', () => {
    const commits: CommitInfo[] = [
      {
        sha: 'merge',
        short_sha: 'merge',
        message: 'Merge branch feat into main',
        author_name: 'Bob',
        author_email: 'bob@example.com',
        timestamp: 2004,
        relative_date: 'now',
        parent_shas: ['main_parent', 'feat_parent'],
      },
      {
        sha: 'main_parent',
        short_sha: 'main_p',
        message: 'Main commit',
        author_name: 'Bob',
        author_email: 'bob@example.com',
        timestamp: 2003,
        relative_date: '1m ago',
        parent_shas: ['base'],
      },
      {
        sha: 'feat_parent',
        short_sha: 'feat_p',
        message: 'Feature commit',
        author_name: 'Alice',
        author_email: 'alice@example.com',
        timestamp: 2002,
        relative_date: '2m ago',
        parent_shas: ['base'],
      },
      {
        sha: 'base',
        short_sha: 'base',
        message: 'Common base commit',
        author_name: 'Alice',
        author_email: 'alice@example.com',
        timestamp: 2001,
        relative_date: '3m ago',
        parent_shas: [],
      },
    ];

    const nodes = computeGitGraphLayout(commits);
    expect(nodes.size).toBe(4);

    const mergeNode = nodes.get('merge')!;
    expect(mergeNode.isMerge).toBe(true);
    expect(mergeNode.outSegments.length).toBe(2);
    expect(mergeNode.outSegments[0].toLane).toBe(0);
    expect(mergeNode.outSegments[1].toLane).toBe(1);

    const featNode = nodes.get('feat_parent')!;
    expect(featNode.lane).toBe(1);
    expect(featNode.outSegments[0].fromLane).toBe(1);
    expect(featNode.outSegments[0].toLane).toBe(0);

    const baseNode = nodes.get('base')!;
    expect(baseNode.lane).toBe(0);
    expect(baseNode.hasIncoming).toBe(true);
    expect(baseNode.inSegments.length).toBe(1);
    expect(baseNode.inSegments[0].toLane).toBe(0);
  });
});
