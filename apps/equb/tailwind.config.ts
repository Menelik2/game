import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        equb: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
          950: '#022c22',
        },
        gold: { 400: '#fbbf24', 500: '#f59e0b' },
        surface: {
          800: '#12201a',
          900: '#0a1210',
          950: '#050a08',
        },
      },
    },
  },
  plugins: [],
};
export default config;
