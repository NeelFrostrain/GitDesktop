import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

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
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
