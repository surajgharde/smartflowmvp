/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Control-room surface ramp
        ink: {
          950: '#070b14',
          900: '#0b1120',
          850: '#0f1729',
          800: '#141d33',
          700: '#1d2942',
          600: '#2a3856',
          500: '#3b4a6f',
        },
        brand: {
          50: '#ecfeff',
          200: '#a5f3fc',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
        // Congestion semantics — used identically on map, charts and badges
        flow: {
          free: '#22c55e',
          moderate: '#eab308',
          heavy: '#f97316',
          severe: '#ef4444',
        },
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 18px 40px -24px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 0 32px -8px rgba(34,211,238,0.45)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.9' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        sweep: 'sweep 2.2s ease-in-out infinite',
        riseIn: 'riseIn 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
