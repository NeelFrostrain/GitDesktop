import { useEffect } from 'react';
import { useRemoteServicesStore } from '../store/remoteStore';
import { useGitStore } from '../../../store/useGitStore';

export const useRemotes = () => {
  const store = useRemoteServicesStore();
  const activeRepoPath = useGitStore((state) => state.activeRepoPath);

  useEffect(() => {
    if (activeRepoPath) {
      store.loadRemotes(activeRepoPath);
    }
  }, [activeRepoPath]);

  return { ...store, activeRepoPath };
};
