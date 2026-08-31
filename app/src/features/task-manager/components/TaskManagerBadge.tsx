import React from 'react';
import { Activity } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';

interface TaskManagerBadgeProps {
  className?: string;
}

export const TaskManagerBadge: React.FC<TaskManagerBadgeProps> = ({ className = '' }) => {
  const toggleModal = useTaskStore((s) => s.toggleModal);
  const isModalOpen = useTaskStore((s) => s.isModalOpen);

  return (
    <button
      type="button"
      onClick={toggleModal}
      title="Task Manager & Background Operations"
      className={`titlebar-no-drag h-6.5 px-2.5 flex items-center gap-1.5 rounded-sm border transition cursor-pointer text-xs font-semibold select-none group shadow-2xs outline-none focus:outline-none ${
        isModalOpen
          ? 'bg-commito-coral/20 border-commito-coral text-commito-coral font-bold'
          : 'bg-base-1 hover:bg-base-2 active:bg-base-3 border-border text-text-primary'
      } ${className}`}
    >
      <Activity className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
      <span>Tasks</span>
    </button>
  );
};
