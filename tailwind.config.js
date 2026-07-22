/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f4f6fb',
          100: '#e7ebf5',
          200: '#c7d0e6',
          300: '#97a6cc',
          400: '#5f74a4',
          500: '#374d7d',
          600: '#233563',
          700: '#18274c',
          800: '#101d3c',
          900: '#0a1733',
          DEFAULT: '#0a1733',
        },
        maroon: {
          50: '#fbf0f7',
          100: '#f6dcec',
          200: '#ecb8d7',
          300: '#dd85b7',
          400: '#c24f92',
          500: '#98266c',
          600: '#5e0743',
          700: '#4d0537',
          800: '#3a042a',
          900: '#28031d',
          DEFAULT: '#5e0743',
        },
        sunburst: {
          50: '#fff5e9',
          100: '#ffe6c9',
          200: '#ffca8e',
          300: '#ffab51',
          400: '#ff8f26',
          500: '#ff7300',
          600: '#e65f00',
          700: '#bf4c00',
          800: '#983d05',
          900: '#7c3408',
          DEFAULT: '#ff7300',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '0.85rem',
        '2xl': '1.1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 23, 51, 0.06), 0 6px 20px -12px rgba(10, 23, 51, 0.25)',
        lift: '0 6px 16px -6px rgba(10, 23, 51, 0.22), 0 18px 40px -20px rgba(10, 23, 51, 0.35)',
        modal: '0 24px 60px -18px rgba(10, 23, 51, 0.45)',
        pop: '0 10px 32px -8px rgba(10, 23, 51, 0.28)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shake: 'shake 0.45s ease-in-out',
        'fade-in': 'fade-in 0.14s ease-out',
      },
    },
  },
  plugins: [],
}
