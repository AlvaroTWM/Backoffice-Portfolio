export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        loyalty: {
          fresh: '#00A86B',
          'fresh-strong': '#008F5A',
          'fresh-soft': '#C4FFD4',
          jungle: '#0B3D36',
          'jungle-muted': '#134E45',
          night: '#0A1614',
          'night-elevated': '#12201D',
          lavanda: '#8B8FE8',
          'lavanda-soft': '#E8E9FA',
          radian: '#C6E04A',
          menta: '#A8D5C8',
          beige: '#F4F1EA',
          'cool-gray': '#8B949E',
          'warm-gray': '#6E6B66',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Montserrat', 'serif'],
        ueno: ['Inter', 'system-ui', 'sans-serif'],
        'ueno-display': ['Montserrat', 'serif'],
      },
      transitionTimingFunction: {
        loyalty: 'cubic-bezier(0.22, 1, 0.36, 1)',
        'loyalty-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        loyalty: '200ms',
        'loyalty-enter': '280ms',
      },
      keyframes: {
        'loyalty-fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'loyalty-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'loyalty-scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'loyalty-fade-up': 'loyalty-fade-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'loyalty-fade-in': 'loyalty-fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'loyalty-scale-in': 'loyalty-scale-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      boxShadow: {
        loyalty: '0 8px 24px rgba(11, 61, 54, 0.12)',
        'loyalty-lg': '0 16px 40px rgba(11, 61, 54, 0.16)',
      },
    },
  },
  plugins: [],
}
