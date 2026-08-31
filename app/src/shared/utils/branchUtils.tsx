import { GitBranch, Globe } from 'lucide-react';
import { BranchInfo } from '../../types/git';
import { DropdownOption } from '../../components/common/Dropdown';

/**
 * Extracts the clean branch name without remote prefix (e.g. 'origin/main' -> 'main').
 */
export function getCleanBranchName(name: string): string {
  const slashIdx = name.indexOf('/');
  return slashIdx !== -1 ? name.slice(slashIdx + 1) : name;
}

/**
 * Formats a list of branches into clean, deduplicated DropdownOption objects.
 * - Local branches are listed first with their current/tracking status.
 * - Remote branches that are already present locally or are symbolic refs (e.g. origin/HEAD) are omitted.
 * - Remote-only branches are listed with a Globe icon and 'remote' badge.
 */
export function formatBranchDropdownOptions(branches: BranchInfo[]): DropdownOption[] {
  const validRemote = branches.filter(
    (b) => b.is_remote && !b.name.endsWith('/HEAD') && !b.name.endsWith('\\HEAD')
  );
  const localBranches = branches.filter((b) => !b.is_remote);

  // Deduplicate local branches by name
  const seenLocal = new Set<string>();
  const uniqueLocalBranches: BranchInfo[] = [];
  for (const b of localBranches) {
    if (!seenLocal.has(b.name)) {
      seenLocal.add(b.name);
      uniqueLocalBranches.push(b);
    }
  }

  const localCleanNames = new Set(uniqueLocalBranches.map((b) => b.name));

  // 1. Local branch options
  const localOptions: DropdownOption[] = uniqueLocalBranches.map((b) => {
    const matchingRemote = validRemote.find((r) => getCleanBranchName(r.name) === b.name);
    return {
      value: b.name,
      label: b.name,
      icon: <GitBranch className="w-3.5 h-3.5 text-commito-coral shrink-0" />,
      badge: b.is_current ? 'current' : matchingRemote ? 'origin' : undefined,
      badgeVariant: b.is_current ? 'primary' : 'info',
    };
  });

  // 2. Remote-only branch options (excluding duplicates of local branches and /HEAD)
  const seenRemote = new Set<string>();
  const remoteOnlyOptions: DropdownOption[] = validRemote
    .filter((b) => !localCleanNames.has(getCleanBranchName(b.name)))
    .filter((b) => {
      if (seenRemote.has(b.name)) return false;
      seenRemote.add(b.name);
      return true;
    })
    .map((b) => ({
      value: b.name,
      label: b.name,
      icon: <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
      badge: 'remote',
      badgeVariant: 'muted',
    }));

  return [...localOptions, ...remoteOnlyOptions];
}
