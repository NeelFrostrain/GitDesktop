import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGitStore } from '../../store/useGitStore';
import { useRepoStore } from '../../store/repoStore';
import { Sidebar } from './Sidebar';

describe('Route-Aware Sidebar Component', () => {
  beforeEach(() => {
    useGitStore.setState({
      activeRepoPath: '/mock/repo',
      currentNavView: 'home',
      status: {
        current_branch: 'main',
        ahead: 0,
        behind: 0,
        files: [
          { path: 'src/App.tsx', status: 'Modified', staged: true },
          { path: 'src/index.css', status: 'Untracked', staged: false },
        ],
        is_clean: false,
        has_conflicts: false,
      },
      user: {
        id: 'u1',
        name: 'Alex Developer',
        username: 'alexdev',
        provider: 'gitlab',
        email: 'alex@example.com',
        avatar_url: '',
        web_url: 'https://gitlab.com/alexdev',
        server_url: 'https://gitlab.com',
      },
      stagedFiles: ['src/App.tsx'],
      commitSummary: '',
      activeTab: 'changes',
    });

    useRepoStore.setState({
      repos: [
        {
          id: 'repo-1',
          name: 'backend-api',
          path: '/mock/backend-api',
          pinned: false,
          last_opened_at: 100,
        },
        {
          id: 'repo-2',
          name: 'frontend-web',
          path: '/mock/frontend-web',
          pinned: true,
          last_opened_at: 200,
        },
      ],
      statuses: {
        '/mock/frontend-web': {
          current_branch: 'develop',
          ahead: 1,
          behind: 0,
          dirty_files: 3,
          last_commit_summary: 'update ui',
          last_commit_at: 200,
          last_commit_sha: 'abc1234',
          remote_provider: 'gitlab',
        },
      },
    });
  });

  it('renders HomeSidebar when route is "home"', () => {
    useGitStore.setState({ currentNavView: 'home' });
    render(<Sidebar />);

    // Should contain repository search and list
    expect(screen.getByPlaceholderText('Filter repositories...')).toBeTruthy();
    expect(screen.getByText('Repositories')).toBeTruthy();
    expect(screen.getByText('Alex Developer')).toBeTruthy();

    // Should NOT contain repo workspace commit box or Changes tab count
    expect(screen.queryByText(/changed files/i)).toBeNull();
  });

  it('renders pinned repos first and shows branch chip', () => {
    useGitStore.setState({ currentNavView: 'home' });
    render(<Sidebar />);

    expect(screen.getByText('frontend-web')).toBeTruthy();
    expect(screen.getByText('develop')).toBeTruthy();
    expect(screen.getByText('backend-api')).toBeTruthy();
  });

  it('renders RepoSidebar when route is "changes" or "workspace"', () => {
    useGitStore.setState({ currentNavView: 'changes' });
    render(<Sidebar />);

    // Should render Changes/History tabs and commit trigger button
    expect(screen.getByText('1 of 2 changed files')).toBeTruthy();
    expect(screen.getByText(/initialize commit/i)).toBeTruthy();

    // Should NOT contain the HomeSidebar repo filter box
    expect(screen.queryByPlaceholderText('Filter repositories...')).toBeNull();
  });

  it('switches to repo workspace when clicking a repo in HomeSidebar', async () => {
    useGitStore.setState({ currentNavView: 'home' });
    render(<Sidebar />);

    const repoItem = screen.getByText('frontend-web');
    fireEvent.click(repoItem);

    expect(useGitStore.getState().activeRepoPath).toBe('/mock/frontend-web');
    expect(useGitStore.getState().currentNavView).toBe('changes');
  });
});
