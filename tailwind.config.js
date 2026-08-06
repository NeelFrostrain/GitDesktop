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
          0: '#171719', // Main app near-black background
          1: '#1f1e24', // Card & Panel background
          2: '#28272d', // Table header / elevated card
          3: '#33323a', // Hover & active state
        },
        border: {
          DEFAULT: '#36353d',
          strong: '#46454e',
        },
        text: {
          primary: '#e1e0e5',
          secondary: '#bfbee2',
          muted: '#8f8e9a',
          faint: '#6e6d78',
        },
        gitlab: {
          orange: '#fc6d26',
          purple: '#7b58cf',
          purpleLight: '#3a2d6b',
          teal: '#108548',
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
      }
    },
  },
  plugins: [],
}
