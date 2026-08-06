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
          0: '#0a0a10',
          1: '#0d0d14',
          2: '#17171f',
          3: '#1a1a24',
        },
        border: {
          DEFAULT: '#26262e',
          strong: '#2c2c36',
        },
        text: {
          primary: '#f0f0f3',
          secondary: '#c8c8ce',
          muted: '#8a8a92',
          faint: '#7a7a85',
        },
        gitlab: {
          orange: '#fc6d26',
          purple: '#534ab7',
          purpleLight: '#eeedfe',
          teal: '#0f6e56',
        },
        github: {
          dark: {
            bg: '#0d0d14',
            sidebar: '#0a0a10',
            header: '#17171f',
            border: '#26262e',
            hover: '#1a1a24',
            accent: '#539bf5',
            success: '#0f6e56',
            danger: '#e5534b',
            warning: '#c69026',
            text: '#c8c8ce',
            heading: '#f0f0f3',
          }
        }
      }
    },
  },
  plugins: [],
}
