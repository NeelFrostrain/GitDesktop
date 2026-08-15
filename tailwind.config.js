/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          0: 'var(--app-bg-secondary, #121113)', // Deep dark app frame
          1: 'var(--app-bg-primary, #171619)',   // Main workspace background
          2: 'var(--app-bg-elevated, #201e22)',  // Elevated cards & panels
          3: 'var(--app-surface-hover, #2b292f)',// Hover & subtle highlights
        },
        border: {
          DEFAULT: 'var(--app-border, #29272b)',
          strong: 'var(--app-border-strong, #3d3a42)',
        },
        text: {
          primary: 'var(--app-text-primary, #e6e4e8)',
          secondary: 'var(--app-text-secondary, #b3b0b8)',
          muted: 'var(--app-text-muted, #85818c)',
          faint: '#5c5863',
          onAccent: 'var(--app-text-on-accent, #ffffff)',
        },
        commito: {
          coral: 'var(--app-accent, #e05638)',
          coralHover: 'var(--app-accent-hover, #f06344)',
          activeBg: 'var(--app-surface-active, #382221)',
          activeText: '#f5a494',
          green: 'var(--app-success, #22c55e)',
          card: 'var(--app-bg-elevated, #1e1c21)',
        },
        git: {
          added: 'var(--git-added, #22c55e)',
          removed: 'var(--git-removed, #ef4444)',
          modified: 'var(--git-modified, #eab308)',
          renamed: 'var(--git-renamed, #3b82f6)',
          conflict: 'var(--git-conflict, #f97316)',
          ahead: 'var(--git-ahead, #22c55e)',
          behind: 'var(--git-behind, #ef4444)',
        },
        gitlab: {
          orange: 'var(--provider-gitlab, #e05638)',
          purple: '#7b58cf',
          purpleLight: '#3a2d6b',
          teal: 'var(--app-success, #22c55e)',
          blue: '#1f75cb',
        },
        github: {
          dark: {
            bg: 'var(--app-bg-primary, #171719)',
            sidebar: 'var(--app-bg-secondary, #1f1e24)',
            header: 'var(--app-bg-elevated, #28272d)',
            border: 'var(--app-border, #36353d)',
            hover: 'var(--app-surface-hover, #33323a)',
            accent: '#1f75cb',
            success: 'var(--app-success, #108548)',
            danger: 'var(--app-error, #dd2b0e)',
            warning: 'var(--app-warning, #c17d10)',
            text: 'var(--app-text-primary, #e1e0e5)',
            heading: '#ffffff',
          }
        }
      },
      fontFamily: {
        sans: ['var(--app-font-family)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--terminal-font-family)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--app-radius-sm, 4px)',
        DEFAULT: 'var(--app-radius-md, 6px)',
        md: 'var(--app-radius-md, 6px)',
        lg: 'var(--app-radius-lg, 12px)',
        xl: 'calc(var(--app-radius-lg, 12px) + 4px)',
      },
      boxShadow: {
        sm: 'var(--app-shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.25))',
        DEFAULT: 'var(--app-shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.4))',
        md: 'var(--app-shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.4))',
        lg: 'var(--app-shadow-lg, 0 10px 25px -3px rgba(0, 0, 0, 0.6))',
      },
    },
  },
  plugins: [],
}
