/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#13131A',
        border: '#1E1E2E',
        primary: '#00F5A0',
        secondary: '#7B61FF',
        danger: '#FF4D6D',
        chartblue: '#3FA9FF',
        chartorange: '#FF9F40',
        txt: '#F0F0F5',
        muted: '#6B6B80',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 16px rgba(0, 245, 160, 0.45)',
        'glow-sm': '0 0 8px rgba(0, 245, 160, 0.35)',
        'glow-purple': '0 0 16px rgba(123, 97, 255, 0.45)',
      },
      borderRadius: {
        card: '14px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
