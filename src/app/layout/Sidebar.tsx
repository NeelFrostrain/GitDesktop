import React, { useState, useEffect, useRef } from "react";
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
  const latestSidebarWidthRef = useRef(sidebarWidth);
  latestSidebarWidthRef.current = sidebarWidth;

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const newWidth = Math.max(240, Math.min(520, e.clientX));
        latestSidebarWidthRef.current = newWidth;
        setSidebarWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(false);
      try {
        localStorage.setItem(
          "sidebar_width",
          latestSidebarWidthRef.current.toString(),
        );
      } catch {}
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  return (
    <aside
      style={{ width: "100%", height: "100%" }}
      className="relative h-full bg-base-0 border border-border/80 rounded-sm flex flex-col flex-shrink-0 select-none z-20 overflow-hidden shadow-2xs"
    >
      {/* Dynamic Route-Aware Sidebar */}
      {route === "home" ? <HomeSidebar /> : <RepoSidebar />}
    </aside>
  );
};
