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
        },
        commito: {
          coral: '#e05638',
          coralHover: '#f06344',
          activeBg: '#382221',
          activeText: '#f5a494',
          green: '#22c55e',
          card: '#1e1c21',
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
      }
    },
  },
  plugins: [],
}
