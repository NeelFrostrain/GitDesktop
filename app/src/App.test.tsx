import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGitStore } from './store/useGitStore';
import { Sidebar } from './components/sidebar/Sidebar';

describe('Sidebar Component', () => {
  beforeEach(() => {
    useGitStore.setState({
      activeRepoPath: '/mock/repo',
      currentNavView: 'workspace',
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
      stagedFiles: ['src/App.tsx'],
      commitSummary: '',
      activeTab: 'changes',
    });
  });

  it('renders modified files count in changes tab header', () => {
    render(<Sidebar />);
    expect(screen.getByText('1 of 2 changed files')).toBeTruthy();
  });

  it('disables commit button when commit summary is empty', () => {
    render(<Sidebar />);
    const triggerBtn = screen.getByText(/initialize commit/i);
    fireEvent.click(triggerBtn);
    const commitBtn = screen.getByText(/commit.*to main/i);
    expect(commitBtn.closest('button')?.disabled).toBe(true);
  });

  it('enables commit button when commit summary is provided', () => {
    useGitStore.setState({ commitSummary: 'feat: add user authentication' });
    render(<Sidebar />);
    const triggerBtn = screen.getByText(/initialize commit/i);
    fireEvent.click(triggerBtn);
    const commitBtn = screen.getByText(/commit.*to main/i);
    expect(commitBtn.closest('button')?.disabled).toBe(false);
  });
});
