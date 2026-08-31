import { useRepoStore } from '../../store/repoStore';

export { useRepoStore };

/**
 * Shared helper to open a repository workspace.
 * Sets the active repository path, switches the route to the repo workspace ('changes' view),
 * and touches the repository in the registry.
 */
export async function openRepo(path: string): Promise<void> {
  return useRepoStore.getState().openRepo(path);
}
