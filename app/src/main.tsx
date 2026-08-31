import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import { ThemeProvider } from './shared/theme';
import './main.css';

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
document.addEventListener('contextmenu', (event: MouseEvent) => {
  event.preventDefault();
  // Future: showCustomContextMenu(event.clientX, event.clientY, event.target);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </QueryClientProvider>
);

// Ensure window is shown, restored to screen bounds, and focused
requestAnimationFrame(async () => {
  try {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    const isMax = await win.isMaximized().catch(() => false);
    if (!isMax) {
      const pos = await win.outerPosition().catch(() => null);
      if (pos && (pos.x < -200 || pos.y < -200 || pos.x > 8000 || pos.y > 8000)) {
        await win.center().catch(() => {});
      }
    }
    await win.setFocus().catch(() => {});
  } catch (err) {
    console.error('Window recovery error:', err);
  }
});
