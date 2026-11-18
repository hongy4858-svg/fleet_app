/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0F172A',
          navyLight: '#1E293B',
          navyLighter: '#334155',
          teal: '#0D9488',
          tealLight: '#14B8A6',
          tealDark: '#0F766E',
          accent: '#0284C7',
        }
      }
    },
  },
  plugins: [],
}

