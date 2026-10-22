/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030712',
          900: '#0a0f1e',
          850: '#0d1526',
          800: '#111827',
          750: '#141e35',
          700: '#1a2744',
          600: '#243356',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      boxShadow: {
        glow: '0 0 20px rgba(16,185,129,0.15)',
        'glow-red': '0 0 20px rgba(244,63,94,0.2)',
        'glow-amber': '0 0 20px rgba(245,158,11,0.15)',
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        modal: '0 25px 50px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
