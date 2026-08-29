import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutocompletePopup } from './AutocompletePopup';
import { AutocompleteSuggestion } from '../types';

describe('AutocompletePopup Component', () => {
  const sampleSuggestions: AutocompleteSuggestion[] = [
    {
      text: 'status',
      value: 'status',
      description: 'Show working tree and staging area status',
      kind: 'command',
    },
    {
      text: 'commit',
      value: 'commit',
      description: 'Record changes to the repository',
      kind: 'command',
    },
    {
      text: 'checkout',
      value: 'checkout',
      description: 'Switch branches or restore working tree files',
      kind: 'command',
    },
  ];

  it('renders all suggestion commands in full without truncation', () => {
    const onSelect = vi.fn();
    render(
      <AutocompletePopup suggestions={sampleSuggestions} selectedIndex={0} onSelect={onSelect} />
    );

    expect(screen.getByText('status')).toBeTruthy();
    expect(screen.getByText('commit')).toBeTruthy();
    expect(screen.getByText('checkout')).toBeTruthy();
    expect(screen.getByText('Show working tree and staging area status')).toBeTruthy();
  });

  it('does NOT render redundant "COMMAND" text pills', () => {
    const onSelect = vi.fn();
    render(
      <AutocompletePopup suggestions={sampleSuggestions} selectedIndex={0} onSelect={onSelect} />
    );

    expect(screen.queryByText('COMMAND')).toBeNull();
  });

  it('highlights the selected index with active accent styling', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <AutocompletePopup suggestions={sampleSuggestions} selectedIndex={1} onSelect={onSelect} />
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(3);

    // Button 1 (commit) should have selected active classes
    expect(buttons[1].className).toContain('border-commito-coral');
    expect(buttons[0].className).toContain('border-transparent');
  });

  it('calls onSelect when clicking a suggestion', () => {
    const onSelect = vi.fn();
    render(
      <AutocompletePopup suggestions={sampleSuggestions} selectedIndex={0} onSelect={onSelect} />
    );

    const commitBtn = screen.getByText('commit');
    fireEvent.click(commitBtn);

    expect(onSelect).toHaveBeenCalledWith(sampleSuggestions[1]);
  });
});
