import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        equb: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        surface: {
          800: '#0f1a17',
          900: '#0a1210',
        },
      },
    },
  },
  plugins: [],
};
export default config;
