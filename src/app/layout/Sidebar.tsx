import React, { useState, useEffect } from "react";
import { useAppRoute } from "../routes";
import { HomeSidebar } from "./home/HomeSidebar";
import { RepoSidebar } from "./repo/RepoSidebar";

export const Sidebar: React.FC = () => {
  const route = useAppRoute();
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("sidebar_width");
      return saved ? Math.max(240, Math.min(520, parseInt(saved, 10))) : 320;
    } catch {
      return 320;
    }
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(520, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("sidebar_width", sidebarWidth.toString());
      } catch {}
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, sidebarWidth]);

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative h-full bg-base-0 border-r border-border flex flex-col flex-shrink-0 select-none group/sidebar z-20"
    >
      {/* Resizable handle bar on the right border */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setSidebarWidth(320)}
        title="Drag to resize sidebar • Double-click to reset"
        className={`absolute top-0 -right-1 w-1 h-full cursor-col-resize z-30 transition-colors flex items-center justify-center ${
          isResizing ? "bg-commito-coral" : "hover:bg-commito-coral/60"
        }`}
      >
        {/* <div className="w-0.5 h-8 rounded-full transition-colors bg-border group-hover/sidebar:bg-commito-coral/80" /> */}
      </div>

      {/* Dynamic Route-Aware Sidebar */}
      {route === "home" ? <HomeSidebar /> : <RepoSidebar />}
    </aside>
  );
};
