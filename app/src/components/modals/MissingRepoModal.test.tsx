import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MissingRepoModal } from './MissingRepoModal';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';

describe('MissingRepoModal Component', () => {
  beforeEach(() => {
    useGitStore.setState({
      isMissingRepoModalOpen: false,
      missingRepoPath: null,
      missingRepoReason: null,
      activeRepoPath: null,
      currentNavView: 'home',
      recentRepos: ['/missing/path/repo-1'],
    });

    useRepoStore.setState({
      repos: [
        {
          id: 'repo-missing-1',
          name: 'repo-1',
          path: '/missing/path/repo-1',
          pinned: false,
          last_opened_at: 100,
        },
      ],
      statuses: {},
    });
  });

  it('renders nothing when closed', () => {
    render(<MissingRepoModal />);
    expect(screen.queryByText('Repository Not Found')).toBeNull();
  });

  it('renders warning details when open with missing path and reason', () => {
    useGitStore.setState({
      isMissingRepoModalOpen: true,
      missingRepoPath: '/missing/path/repo-1',
      missingRepoReason: 'Directory does not exist on disk',
    });

    render(<MissingRepoModal />);

    expect(screen.getByText('Repository Not Found')).toBeTruthy();
    expect(screen.getByText('/missing/path/repo-1')).toBeTruthy();
    expect(screen.getByText(/Directory does not exist on disk/)).toBeTruthy();
    expect(screen.getByText('Remove')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('removes repository from workspace and closes modal on remove click', async () => {
    const removeRepoSpy = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ removeRepo: removeRepoSpy });

    useGitStore.setState({
      isMissingRepoModalOpen: true,
      missingRepoPath: '/missing/path/repo-1',
      missingRepoReason: 'Directory not found',
      activeRepoPath: '/missing/path/repo-1',
    });

    render(<MissingRepoModal />);

    const removeBtn = screen.getByText('Remove');
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(removeRepoSpy).toHaveBeenCalledWith('repo-missing-1');
      expect(useGitStore.getState().isMissingRepoModalOpen).toBe(false);
      expect(useGitStore.getState().activeRepoPath).toBeNull();
      expect(useGitStore.getState().currentNavView).toBe('home');
    });
  });

  it('closes and resets active path to home when closing modal', () => {
    useGitStore.setState({
      isMissingRepoModalOpen: true,
      missingRepoPath: '/missing/path/repo-1',
      activeRepoPath: '/missing/path/repo-1',
      currentNavView: 'changes',
    });

    render(<MissingRepoModal />);

    const homeBtn = screen.getByText('Close');
    fireEvent.click(homeBtn);

    expect(useGitStore.getState().isMissingRepoModalOpen).toBe(false);
    expect(useGitStore.getState().activeRepoPath).toBeNull();
    expect(useGitStore.getState().currentNavView).toBe('home');
  });
});
