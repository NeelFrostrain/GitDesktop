import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SidebarPanelDef {
  id: string;
  title: string;
  icon?: React.ReactNode;
  badge?: number | string;
  content: React.ReactNode;
  defaultCollapsed?: boolean;
  /** If false the panel is not rendered (e.g. feature gated) */
  visible?: boolean;
}

interface Props {
  panels: SidebarPanelDef[];
}

interface PanelState {
  id: string;
  collapsed: boolean;
}

function loadState(panels: SidebarPanelDef[]): PanelState[] {
  try {
    const raw = localStorage.getItem('sidebar_panel_state');
    if (raw) {
      const parsed: PanelState[] = JSON.parse(raw);
      // Merge: preserve existing, append new panels
      const merged = panels
        .filter((p) => p.visible !== false)
        .map((p) => {
          const existing = parsed.find((s) => s.id === p.id);
          return existing ?? { id: p.id, collapsed: p.defaultCollapsed ?? false };
        });
      return merged;
    }
  } catch {}
  return panels
    .filter((p) => p.visible !== false)
    .map((p) => ({ id: p.id, collapsed: p.defaultCollapsed ?? false }));
}

function loadOrder(panels: SidebarPanelDef[]): string[] {
  try {
    const raw = localStorage.getItem('sidebar_panel_order');
    if (raw) {
      const parsed: string[] = JSON.parse(raw);
      const allIds = panels.filter((p) => p.visible !== false).map((p) => p.id);
      const valid = parsed.filter((id) => allIds.includes(id));
      const missing = allIds.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {}
  return panels.filter((p) => p.visible !== false).map((p) => p.id);
}

function saveState(state: PanelState[]) {
  try {
    localStorage.setItem('sidebar_panel_state', JSON.stringify(state));
  } catch {}
}

function saveOrder(order: string[]) {
  try {
    localStorage.setItem('sidebar_panel_order', JSON.stringify(order));
  } catch {}
}

export const SidebarPanelContainer: React.FC<Props> = ({ panels }) => {
  const visiblePanels = panels.filter((p) => p.visible !== false);

  const [panelState, setPanelState] = useState<PanelState[]>(() => loadState(visiblePanels));
  const [order, setOrder] = useState<string[]>(() => loadOrder(visiblePanels));

  // Drag state
  const draggingId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const [draggingPanel, setDraggingPanel] = useState<string | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<string | null>(null);

  const orderedPanels = order
    .map((id) => visiblePanels.find((p) => p.id === id))
    .filter(Boolean) as SidebarPanelDef[];

  const toggleCollapse = (id: string) => {
    setPanelState((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s));
      saveState(next);
      return next;
    });
  };

  const isCollapsed = (id: string) => panelState.find((s) => s.id === id)?.collapsed ?? false;

  /* ── Drag handlers ── */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    draggingId.current = id;
    setDraggingPanel(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggingId.current) {
      dragOverId.current = id;
      setDragOverPanel(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingId.current;
    if (!sourceId || sourceId === targetId) return;

    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(sourceId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      saveOrder(next);
      return next;
    });

    draggingId.current = null;
    dragOverId.current = null;
    setDraggingPanel(null);
    setDragOverPanel(null);
  };

  const handleDragEnd = () => {
    draggingId.current = null;
    dragOverId.current = null;
    setDraggingPanel(null);
    setDragOverPanel(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {orderedPanels.map((panel) => {
        const collapsed = isCollapsed(panel.id);
        const isDragging = draggingPanel === panel.id;
        const isDragOver = dragOverPanel === panel.id && draggingPanel !== panel.id;

        return (
          <div
            key={panel.id}
            draggable
            onDragStart={(e) => handleDragStart(e, panel.id)}
            onDragOver={(e) => handleDragOver(e, panel.id)}
            onDrop={(e) => handleDrop(e, panel.id)}
            onDragEnd={handleDragEnd}
            className={`flex flex-col min-h-0 transition-all duration-150 ${
              collapsed ? 'flex-shrink-0' : 'flex-1'
            } ${isDragging ? 'opacity-40' : 'opacity-100'} ${
              isDragOver ? 'ring-1 ring-commito-coral/60 rounded-sm' : ''
            }`}
          >
            {/* Panel Header */}
            <button
              type="button"
              onClick={() => toggleCollapse(panel.id)}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 border-t border-border/60 bg-base-0 hover:bg-base-1/60 transition-colors select-none cursor-pointer group flex-shrink-0"
              title={`${collapsed ? 'Expand' : 'Collapse'} ${panel.title}`}
            >
              {/* Drag grip — tiny dots */}
              <span
                className="flex flex-col gap-[2px] opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
                aria-hidden
              >
                <span className="flex gap-[2px]">
                  <span className="w-[2px] h-[2px] rounded-full bg-text-muted" />
                  <span className="w-[2px] h-[2px] rounded-full bg-text-muted" />
                </span>
                <span className="flex gap-[2px]">
                  <span className="w-[2px] h-[2px] rounded-full bg-text-muted" />
                  <span className="w-[2px] h-[2px] rounded-full bg-text-muted" />
                </span>
                <span className="flex gap-[2px]">
                  <span className="w-[2px] h-[2px] rounded-full bg-text-muted" />
                  <span className="w-[2px] h-[2px] rounded-full bg-text-muted" />
                </span>
              </span>

              {/* Icon */}
              {panel.icon && <span className="text-text-muted flex-shrink-0">{panel.icon}</span>}

              {/* Title */}
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-muted group-hover:text-text-secondary transition-colors flex-1 text-left truncate">
                {panel.title}
              </span>

              {/* Badge */}
              {panel.badge !== undefined && panel.badge !== '' && Number(panel.badge) > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm text-[10px] font-mono font-bold bg-base-2 border border-border text-text-muted flex-shrink-0">
                  {panel.badge}
                </span>
              )}

              {/* Chevron */}
              <ChevronDown
                className={`w-3 h-3 text-text-muted flex-shrink-0 transition-transform duration-200 ${
                  collapsed ? '-rotate-90' : ''
                }`}
              />
            </button>

            {/* Panel Content */}
            {!collapsed && (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{panel.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
