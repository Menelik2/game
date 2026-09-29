import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        apex: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
        },
        gold: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        surface: { 900: '#0a0a0f', 800: '#12121a', 700: '#1a1a26', 600: '#242433' },
      },
      backgroundImage: {
        'hero-glow': 'radial-gradient(ellipse at top, rgba(139,92,246,0.25), transparent 60%)',
      },
      boxShadow: {
        glow: '0 0 40px rgba(139, 92, 246, 0.35)',
        'glow-gold': '0 0 30px rgba(245, 158, 11, 0.3)',
      },
    },
  },
  plugins: [],
};
export default config;
