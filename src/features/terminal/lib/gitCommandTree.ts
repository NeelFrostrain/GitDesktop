export interface GitFlag {
  flag: string;
  description: string;
  takesValue?: boolean;
}

export interface GitCommandDef {
  description: string;
  subcommands?: string[];
  flags: GitFlag[];
}

export interface GitCommandTree {
  [command: string]: GitCommandDef;
}

export const GIT_COMMAND_TREE: GitCommandTree = {
  status: {
    description: 'Show working tree and staging area status',
    subcommands: [],
    flags: [
      { flag: '-s', description: 'Give output in short format' },
      { flag: '--short', description: 'Give output in short format' },
      { flag: '-b', description: 'Show branch information' },
      { flag: '--branch', description: 'Show branch information' },
      { flag: '-u', description: 'Show untracked files mode', takesValue: true },
      { flag: '--untracked-files', description: 'Show untracked files mode', takesValue: true },
      { flag: '--ignored', description: 'Show ignored files as well' },
    ],
  },
  add: {
    description: 'Add file contents to index / staging area',
    subcommands: [],
    flags: [
      { flag: '-A', description: 'Add all tracked and untracked modified files' },
      { flag: '--all', description: 'Add all tracked and untracked modified files' },
      { flag: '-u', description: 'Update tracked files only' },
      { flag: '--update', description: 'Update tracked files only' },
      { flag: '-p', description: 'Interactively choose hunks of patch to add' },
      { flag: '--patch', description: 'Interactively choose hunks of patch to add' },
      { flag: '-f', description: 'Allow adding otherwise ignored files' },
      { flag: '--force', description: 'Allow adding otherwise ignored files' },
      { flag: '-n', description: 'Dry run, show what would be added' },
      { flag: '--dry-run', description: 'Dry run, show what would be added' },
    ],
  },
  commit: {
    description: 'Record changes to the repository',
    subcommands: [],
    flags: [
      { flag: '-m', description: 'Use the given message as commit message', takesValue: true },
      { flag: '--message', description: 'Use the given message as commit message', takesValue: true },
      { flag: '-a', description: 'Automatically stage modified and deleted files' },
      { flag: '--all', description: 'Automatically stage modified and deleted files' },
      { flag: '--amend', description: 'Amend previous commit' },
      { flag: '--no-verify', description: 'Bypass pre-commit and commit-msg hooks' },
      { flag: '-n', description: 'Bypass pre-commit and commit-msg hooks' },
      { flag: '-s', description: 'Add Signed-off-by trailer' },
      { flag: '--signoff', description: 'Add Signed-off-by trailer' },
      { flag: '--allow-empty', description: 'Allow recording an empty commit' },
      { flag: '-S', description: 'GPG-sign commits' },
      { flag: '--gpg-sign', description: 'GPG-sign commits', takesValue: true },
    ],
  },
  push: {
    description: 'Update remote refs along with associated objects',
    subcommands: [],
    flags: [
      { flag: '-u', description: 'Set upstream for git pull/status' },
      { flag: '--set-upstream', description: 'Set upstream for git pull/status' },
      { flag: '-f', description: 'Force update of remote refs' },
      { flag: '--force', description: 'Force update of remote refs' },
      { flag: '--force-with-lease', description: 'Safe force push that checks remote ref' },
      { flag: '--all', description: 'Push all branches' },
      { flag: '--tags', description: 'Push all tags' },
      { flag: '-d', description: 'Delete remote branch/tag' },
      { flag: '--delete', description: 'Delete remote branch/tag' },
      { flag: '--dry-run', description: 'Dry run without sending data' },
    ],
  },
  pull: {
    description: 'Fetch from and integrate with another repo or local branch',
    subcommands: [],
    flags: [
      { flag: '-r', description: 'Rebase local branch on top of upstream branch' },
      { flag: '--rebase', description: 'Rebase local branch on top of upstream branch' },
      { flag: '--no-rebase', description: 'Merge upstream branch into local branch' },
      { flag: '--ff-only', description: 'Refuse to merge and exit if not fast-forward' },
      { flag: '--autostash', description: 'Automatically create temporary stash before pull' },
      { flag: '--all', description: 'Fetch all remotes' },
    ],
  },
  fetch: {
    description: 'Download objects and refs from another repository',
    subcommands: [],
    flags: [
      { flag: '--all', description: 'Fetch all remotes' },
      { flag: '-p', description: 'Prune remote-tracking references that no longer exist' },
      { flag: '--prune', description: 'Prune remote-tracking references that no longer exist' },
      { flag: '--tags', description: 'Fetch all tags from remote' },
      { flag: '--dry-run', description: 'Dry run, show what would be fetched' },
    ],
  },
  branch: {
    description: 'List, create, or delete branches',
    subcommands: [],
    flags: [
      { flag: '-a', description: 'List both remote-tracking and local branches' },
      { flag: '--all', description: 'List both remote-tracking and local branches' },
      { flag: '-r', description: 'List remote-tracking branches' },
      { flag: '--remotes', description: 'List remote-tracking branches' },
      { flag: '-d', description: 'Delete a branch (safe)' },
      { flag: '-D', description: 'Force delete a branch' },
      { flag: '-m', description: 'Move/rename a branch' },
      { flag: '-M', description: 'Force move/rename a branch' },
      { flag: '-v', description: 'Show commit SHA and subject' },
      { flag: '--show-current', description: 'Print the name of current branch' },
    ],
  },
  checkout: {
    description: 'Switch branches or restore working tree files',
    subcommands: [],
    flags: [
      { flag: '-b', description: 'Create and checkout a new branch' },
      { flag: '-B', description: 'Create/reset and checkout a branch' },
      { flag: '--track', description: 'Set upstream tracking info' },
      { flag: '-f', description: 'Force switch branch (discard local changes)' },
      { flag: '--force', description: 'Force switch branch' },
      { flag: '--ours', description: 'Checkout our version for unmerged files' },
      { flag: '--theirs', description: 'Checkout their version for unmerged files' },
      { flag: '--', description: 'Disambiguate paths from branch names' },
    ],
  },
  switch: {
    description: 'Switch branches',
    subcommands: [],
    flags: [
      { flag: '-c', description: 'Create and switch to a new branch' },
      { flag: '--create', description: 'Create and switch to a new branch' },
      { flag: '-C', description: 'Force create/reset and switch to branch' },
      { flag: '--detach', description: 'Switch to commit in detached HEAD mode' },
      { flag: '--discard-changes', description: 'Proceed even if index or working tree differs' },
    ],
  },
  restore: {
    description: 'Restore working tree files or index',
    subcommands: [],
    flags: [
      { flag: '-s', description: 'Restore from specified source tree-ish', takesValue: true },
      { flag: '--source', description: 'Restore from specified source tree-ish', takesValue: true },
      { flag: '-S', description: 'Restore staged contents' },
      { flag: '--staged', description: 'Restore staged contents' },
      { flag: '-W', description: 'Restore working tree contents' },
      { flag: '--worktree', description: 'Restore working tree contents' },
      { flag: '-p', description: 'Interactively select hunks to restore' },
      { flag: '--patch', description: 'Interactively select hunks to restore' },
    ],
  },
  merge: {
    description: 'Join two or more development histories together',
    subcommands: [],
    flags: [
      { flag: '--no-ff', description: 'Create a merge commit even if fast-forward is possible' },
      { flag: '--ff-only', description: 'Refuse to merge unless fast-forward' },
      { flag: '--squash', description: 'Squash commits into a single commit on current branch' },
      { flag: '--abort', description: 'Abort the current conflict resolution process' },
      { flag: '--continue', description: 'Continue the merge after conflicts resolved' },
      { flag: '-m', description: 'Set commit message for merge commit', takesValue: true },
    ],
  },
  rebase: {
    description: 'Reapply commits on top of another base tip',
    subcommands: [],
    flags: [
      { flag: '-i', description: 'Start interactive rebase session' },
      { flag: '--interactive', description: 'Start interactive rebase session' },
      { flag: '--continue', description: 'Restart rebasing process after resolving conflict' },
      { flag: '--abort', description: 'Abort rebase and reset HEAD to original branch' },
      { flag: '--skip', description: 'Skip current patch and continue rebasing' },
      { flag: '--onto', description: 'Specify starting point for rebase', takesValue: true },
      { flag: '--autostash', description: 'Automatically create and apply stash' },
    ],
  },
  reset: {
    description: 'Reset current HEAD to specified state',
    subcommands: [],
    flags: [
      { flag: '--soft', description: 'Do not touch index or working tree (keeps staged changes)' },
      { flag: '--mixed', description: 'Resets index but not working tree (default)' },
      { flag: '--hard', description: 'Resets index and working tree (discards all changes)' },
      { flag: '--keep', description: 'Resets index and updates files that differ between commit and HEAD' },
    ],
  },
  stash: {
    description: 'Stash changes in a dirty working directory away',
    subcommands: ['push', 'pop', 'apply', 'list', 'show', 'drop', 'clear', 'branch'],
    flags: [
      { flag: '-u', description: 'Include untracked files in stash' },
      { flag: '--include-untracked', description: 'Include untracked files in stash' },
      { flag: '-a', description: 'Include all files (untracked and ignored)' },
      { flag: '--all', description: 'Include all files' },
      { flag: '-m', description: 'Message description for stash', takesValue: true },
      { flag: '-p', description: 'Interactively select hunks to stash' },
    ],
  },
  log: {
    description: 'Show commit logs',
    subcommands: [],
    flags: [
      { flag: '--oneline', description: 'Shorthand for --pretty=oneline --abbrev-commit' },
      { flag: '--graph', description: 'Draw graphical commit representation' },
      { flag: '--decorate', description: 'Show ref names of any commits shown' },
      { flag: '-n', description: 'Limit number of commits to show', takesValue: true },
      { flag: '--stat', description: 'Generate a diffstat for each commit' },
      { flag: '-p', description: 'Show full diff with each commit' },
      { flag: '--author', description: 'Limit commits to given author', takesValue: true },
    ],
  },
  diff: {
    description: 'Show changes between commits, commit and working tree, etc',
    subcommands: [],
    flags: [
      { flag: '--staged', description: 'View changes staged for the next commit' },
      { flag: '--cached', description: 'Synonym for --staged' },
      { flag: '--stat', description: 'Generate a diffstat instead of full patch' },
      { flag: '--name-only', description: 'Show only names of changed files' },
      { flag: '--name-status', description: 'Show names and status of changed files' },
      { flag: '-w', description: 'Ignore whitespace changes' },
      { flag: '--ignore-all-space', description: 'Ignore whitespace changes' },
    ],
  },
  tag: {
    description: 'Create, list, delete or verify tag objects',
    subcommands: [],
    flags: [
      { flag: '-a', description: 'Make an unsigned, annotated tag object' },
      { flag: '-m', description: 'Use the given tag message', takesValue: true },
      { flag: '-d', description: 'Delete existing tags with the given names' },
      { flag: '-l', description: 'List tags with matching pattern', takesValue: true },
      { flag: '-s', description: 'Make a GPG-signed tag' },
    ],
  },
  remote: {
    description: 'Manage set of tracked repositories',
    subcommands: ['add', 'remove', 'rename', 'set-url', 'get-url', 'show', 'prune', 'update'],
    flags: [
      { flag: '-v', description: 'Be a little more verbose and show remote url after name' },
      { flag: '--verbose', description: 'Be verbose and show remote url' },
    ],
  },
  cherry_pick: {
    description: 'Apply the changes introduced by some existing commits',
    subcommands: [],
    flags: [
      { flag: '-e', description: 'Edit commit message prior to committing' },
      { flag: '-x', description: 'Append note saying where commit was cherry-picked from' },
      { flag: '-n', description: 'Apply changes without making a commit' },
      { flag: '--no-commit', description: 'Apply changes without making a commit' },
      { flag: '--continue', description: 'Continue the operation in progress' },
      { flag: '--abort', description: 'Cancel the operation and return to pre-sequence state' },
      { flag: '--skip', description: 'Skip current commit and continue' },
    ],
  },
  'cherry-pick': {
    description: 'Apply changes introduced by some existing commits',
    subcommands: [],
    flags: [
      { flag: '-e', description: 'Edit commit message prior to committing' },
      { flag: '-x', description: 'Append note saying where commit was cherry-picked from' },
      { flag: '-n', description: 'Apply changes without making a commit' },
      { flag: '--no-commit', description: 'Apply changes without making a commit' },
      { flag: '--continue', description: 'Continue the operation in progress' },
      { flag: '--abort', description: 'Cancel the operation and return to pre-sequence state' },
      { flag: '--skip', description: 'Skip current commit and continue' },
    ],
  },
  revert: {
    description: 'Revert some existing commits',
    subcommands: [],
    flags: [
      { flag: '-e', description: 'Edit commit message before committing revert' },
      { flag: '-n', description: 'Revert changes without making a commit' },
      { flag: '--no-commit', description: 'Revert changes without making a commit' },
      { flag: '--continue', description: 'Continue operation in progress' },
      { flag: '--abort', description: 'Cancel operation in progress' },
    ],
  },
  blame: {
    description: 'Show what revision and author last modified each line of a file',
    subcommands: [],
    flags: [
      { flag: '-L', description: 'Annotate only given line range', takesValue: true },
      { flag: '-w', description: 'Ignore whitespace when comparing parent version' },
      { flag: '-C', description: 'Detect lines moved or copied in other files' },
    ],
  },
  show: {
    description: 'Show various types of objects (commits, tags, trees)',
    subcommands: [],
    flags: [
      { flag: '--stat', description: 'Generate diffstat' },
      { flag: '--oneline', description: 'Show in one line' },
      { flag: '--name-only', description: 'Show names of changed files only' },
    ],
  },
  clean: {
    description: 'Remove untracked files from the working tree',
    subcommands: [],
    flags: [
      { flag: '-d', description: 'Remove untracked directories in addition to untracked files' },
      { flag: '-f', description: 'Force clean untracked files' },
      { flag: '--force', description: 'Force clean untracked files' },
      { flag: '-n', description: 'Dry run, show what would be removed' },
      { flag: '--dry-run', description: 'Dry run, show what would be removed' },
      { flag: '-x', description: 'Remove ignored files too' },
    ],
  },
  worktree: {
    description: 'Manage multiple working trees',
    subcommands: ['add', 'list', 'lock', 'move', 'prune', 'remove', 'unlock'],
    flags: [
      { flag: '-b', description: 'Create a new branch for the worktree', takesValue: true },
      { flag: '-f', description: 'Force worktree action' },
    ],
  },
  lfs: {
    description: 'Git Large File Storage (LFS) extension',
    subcommands: ['track', 'untrack', 'ls-files', 'locks', 'lock', 'unlock', 'push', 'pull', 'fetch', 'prune'],
    flags: [
      { flag: '--all', description: 'Act on all LFS files' },
    ],
  },
  submodule: {
    description: 'Initialize, update or inspect submodules',
    subcommands: ['add', 'status', 'init', 'deinit', 'update', 'set-branch', 'set-url', 'summary', 'foreach', 'sync'],
    flags: [
      { flag: '--init', description: 'Initialize submodules if not already initialized' },
      { flag: '--recursive', description: 'Traverse submodules recursively' },
      { flag: '--remote', description: 'Use submodule remote tracking branch' },
    ],
  },
  reflog: {
    description: 'Manage reflog information',
    subcommands: ['show', 'expire', 'delete', 'exists'],
    flags: [
      { flag: '-n', description: 'Limit number of entries to show', takesValue: true },
    ],
  },
  clone: {
    description: 'Clone a repository into a new directory',
    subcommands: [],
    flags: [
      { flag: '--depth', description: 'Create shallow clone with given history depth', takesValue: true },
      { flag: '--branch', description: 'Point HEAD to given branch after clone', takesValue: true },
      { flag: '-b', description: 'Point HEAD to given branch', takesValue: true },
      { flag: '--recurse-submodules', description: 'Initialize and clone submodules' },
    ],
  },
  init: {
    description: 'Create an empty Git repository or reinitialize an existing one',
    subcommands: [],
    flags: [
      { flag: '-b', description: 'Specify initial branch name', takesValue: true },
      { flag: '--initial-branch', description: 'Specify initial branch name', takesValue: true },
      { flag: '--bare', description: 'Create a bare repository' },
    ],
  },
};
