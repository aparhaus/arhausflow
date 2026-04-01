/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: '#0f1720',
        panel: '#16212b',
        steel: '#243443',
        accent: '#f97316',
        signal: {
          good: '#22c55e',
          warn: '#f59e0b',
          bad: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Aptos', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 18px 40px rgba(8, 15, 23, 0.24)',
      },
    },
  },
  plugins: [],
};
