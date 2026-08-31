import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useGitStore } from '../../../store/useGitStore';
import { StashedChangesSidebarItem } from '../../sidebar/changes/StashedChangesSidebarItem';
import { StashedFileListPanel } from '../../sidebar/changes/StashedFileListPanel';
import { StashedChangesView } from './StashedChangesView';

vi.mock('../../../services/git/gitService', () => ({
  GitService: {
    getStashFiles: vi.fn().mockResolvedValue([
      { path: 'd.tsx', status: 'Untracked', staged: false },
      { path: 'sample_project/agent/memory.json', status: 'Modified', staged: false },
    ]),
    getStashFileDiff: vi.fn().mockResolvedValue({
      file_path: 'd.tsx',
      lines: [
        {
          line_type: 'addition',
          old_line_num: null,
          new_line_num: 1,
          content: 'export const hello = true;',
        },
      ],
      is_binary: false,
      is_large_file: false,
      file_size_bytes: 30,
    }),
    popStash: vi.fn().mockResolvedValue(undefined),
    dropStash: vi.fn().mockResolvedValue(undefined),
    getRepoStatus: vi.fn().mockResolvedValue({
      current_branch: 'dev',
      ahead: 0,
      behind: 0,
      files: [],
      is_clean: true,
      has_conflicts: false,
    }),
  },
}));

describe('Stashed Changes Workflow', () => {
  beforeEach(() => {
    useGitStore.setState({
      activeRepoPath: '/mock/repo',
      status: {
        current_branch: 'dev',
        ahead: 0,
        behind: 0,
        files: [],
        is_clean: true,
        has_conflicts: false,
      },
      currentBranchStash: {
        index: 0,
        sha: 'abc1234',
        message: 'Saved changes on dev before checkout',
        branch: 'dev',
        date: '2 hours ago',
      },
      stashFiles: [
        { path: 'd.tsx', status: 'Untracked', staged: false },
        { path: 'sample_project/agent/memory.json', status: 'Modified', staged: false },
      ],
      isViewingStashedChanges: false,
      selectedStashFile: 'd.tsx',
    });
  });

  it('renders StashedChangesSidebarItem when branch stash exists', () => {
    render(<StashedChangesSidebarItem />);
    expect(screen.getByText('Stashed Changes')).toBeTruthy();
  });

  it('renders StashedFileListPanel in sidebar with stashed files', () => {
    render(<StashedFileListPanel />);
    expect(screen.getByText('2 stashed files')).toBeTruthy();
    expect(screen.getByText('d.tsx')).toBeTruthy();
    expect(screen.getByText('memory.json')).toBeTruthy();
  });

  it('renders StashedChangesView with Restore & Discard buttons and full diff', async () => {
    render(<StashedChangesView />);

    expect(screen.getByText('Stashed changes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /restore/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /discard/i })).toBeTruthy();
    expect(screen.getByText(/will move your stashed files to the Changes list/i)).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('d.tsx')).toBeTruthy();
    });
  });

  it('triggers restoreCurrentBranchStash when clicking Restore', async () => {
    const restoreSpy = vi.fn().mockResolvedValue(undefined);
    useGitStore.setState({ restoreCurrentBranchStash: restoreSpy });

    render(<StashedChangesView />);
    const restoreBtn = screen.getByRole('button', { name: /restore/i });
    fireEvent.click(restoreBtn);

    expect(restoreSpy).toHaveBeenCalled();
  });

  it('opens confirmation modal when clicking Discard', async () => {
    render(<StashedChangesView />);
    const discardBtn = screen.getByRole('button', { name: /discard/i });
    fireEvent.click(discardBtn);

    expect(screen.getByText('Discard Stashed Changes?')).toBeTruthy();
  });
});
