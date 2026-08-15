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
          0: '#121113', // Deep dark app frame
          1: '#171619', // Main workspace background
          2: '#201e22', // Elevated cards & panels
          3: '#2b292f', // Hover & subtle highlights
        },
        border: {
          DEFAULT: '#29272b',
          strong: '#3d3a42',
        },
        text: {
          primary: '#e6e4e8',
          secondary: '#b3b0b8',
          muted: '#85818c',
          faint: '#5c5863',
          onAccent: '#ffffff',
        },
        commito: {
          coral: '#e05638',
          coralHover: '#f06344',
          activeBg: '#382221',
          activeText: '#f5a494',
          green: '#22c55e',
          card: '#1e1c21',
        },
        git: {
          added: '#22c55e',
          removed: '#ef4444',
          modified: '#eab308',
          renamed: '#3b82f6',
          conflict: '#f97316',
          ahead: '#22c55e',
          behind: '#ef4444',
        },
        gitlab: {
          orange: '#e05638',
          purple: '#7b58cf',
          purpleLight: '#3a2d6b',
          teal: '#22c55e',
          blue: '#1f75cb',
        },
        github: {
          dark: {
            bg: '#171719',
            sidebar: '#1f1e24',
            header: '#28272d',
            border: '#36353d',
            hover: '#33323a',
            accent: '#1f75cb',
            success: '#108548',
            danger: '#dd2b0e',
            warning: '#c17d10',
            text: '#e1e0e5',
            heading: '#ffffff',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        lg: '0 10px 25px -3px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
