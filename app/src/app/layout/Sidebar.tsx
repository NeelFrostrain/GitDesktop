import React from 'react';
import { useAppRoute } from '../routes';
import { HomeSidebar } from './home/HomeSidebar';
import { RepoSidebar } from './repo/RepoSidebar';

export const Sidebar: React.FC = () => {
  const route = useAppRoute();
  return (
    <aside
      style={{ width: '100%', height: '100%' }}
      className="relative h-full bg-base-0 border-r border-border/80 flex flex-col flex-shrink-0 select-none z-20 overflow-hidden shadow-2xs"
    >
      {/* Dynamic Route-Aware Sidebar */}
      {route === 'home' ? <HomeSidebar /> : <RepoSidebar />}
    </aside>
  );
};
