import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { ThemeProvider } from "./shared/theme";
import "./main.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 mins
      retry: 1,
    },
  },
});

// Disable the native WebView/browser context menu globally.
// Structured to allow a custom application context menu to be added in the future:
//   event → preventDefault() → showCustomContextMenu(event)
document.addEventListener("contextmenu", (event: MouseEvent) => {
  event.preventDefault();
  // Future: showCustomContextMenu(event.clientX, event.clientY, event.target);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// Show the window after React's first paint.
// The window starts hidden (visible: false in tauri.conf.json) to prevent
// the black-screen flash during startup. Requires core:window:allow-show capability.
requestAnimationFrame(() => {
  getCurrentWindow().show().catch(console.error);
});
