import { useGitStore } from '../store/useGitStore';

export type AppRoute = 'home' | 'repo';

export function useAppRoute(): AppRoute {
  const currentNavView = useGitStore((s) => s.currentNavView);
  return currentNavView === 'home' ? 'home' : 'repo';
}

export function setAppRoute(route: AppRoute) {
  if (route === 'home') {
    useGitStore.getState().setCurrentNavView('home');
  } else {
    useGitStore.getState().setCurrentNavView('changes');
  }
}
