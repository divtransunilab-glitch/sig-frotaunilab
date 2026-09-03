/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf2f4',
          100: '#fce4e8',
          200: '#f9cbd3',
          300: '#f4a4b2',
          400: '#eb6f85',
          500: '#c51937',
          600: '#a30d27',
          700: '#870a20',
          800: '#6f0d1e',
          900: '#5a0f1d',
          950: '#33040d',
        },
        navy: {
          50: '#faf5f6',
          100: '#f3e8eb',
          200: '#ebd5db',
          300: '#dcabb6',
          400: '#c87a8b',
          500: '#b05266',
          600: '#92394c',
          700: '#742737',
          800: '#551724',
          900: '#3b0d17',
          950: '#22050c',
        },
        institutional: {
          red: '#a30d27',
          crimson: '#c51937',
          wine: '#5a0f1d',
          dark: '#22050c',
          gold: '#FFAB00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 12px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
