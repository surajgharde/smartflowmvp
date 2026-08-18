/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        // Every numeral in the product is set in mono. In an operations console
        // that reads as instrumentation rather than marketing copy, and it keeps
        // ticking live values from shifting width.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        /**
         * Surfaces are a warm near-black rather than a blue-black. Pure blue-black
         * with a neon accent is the default dark-dashboard look; warming the
         * neutrals a few degrees makes the whole thing feel deliberately chosen.
         */
        ink: {
          950: '#0a0a0b',
          900: '#0f0f11',
          850: '#141416',
          800: '#1a1a1d',
          750: '#212125',
          700: '#2a2a2f',
          600: '#3a3a41',
          500: '#55555e',
        },
        /**
         * Interaction is bone, not a hue. Colour in this product is data — the
         * four congestion bands and the five authority tags. Nothing else gets to
         * use it, so a coloured pixel always means something.
         */
        bone: {
          50: '#faf9f7',
          100: '#f2f0ec',
          200: '#e2ded7',
          300: '#c9c3b9',
          400: '#a39c90',
          500: '#7d766b',
        },
        // Congestion semantics — identical on map, charts, badges and print.
        flow: {
          free: '#4ade80',
          moderate: '#facc15',
          heavy: '#fb923c',
          severe: '#f87171',
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        label: '0.09em',
      },
      boxShadow: {
        // Depth comes from a hairline top highlight plus a soft drop, not a glow.
        panel: '0 0 0 1px rgba(255,255,255,0.04), 0 1px 0 0 rgba(255,255,255,0.03) inset',
        lift: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -32px rgba(0,0,0,0.9)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.85' },
          '70%': { transform: 'scale(1.7)', opacity: '0' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        riseIn: 'riseIn 0.3s cubic-bezier(0.2, 0.7, 0.3, 1) both',
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
};
