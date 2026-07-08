module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 6px 24px rgba(0,212,255,0.06), inset 0 0 12px rgba(0,212,255,0.02)',
        toast: '0 8px 40px rgba(0,0,0,0.6)'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        shake: {
          '10%, 90%': { transform: 'translateX(-1px)' },
          '20%, 80%': { transform: 'translateX(2px)' },
          '30%, 50%, 70%': { transform: 'translateX(-4px)' },
          '40%, 60%': { transform: 'translateX(4px)' }
        }
      },
      animation: {
        'fade-in': 'fadeIn 600ms ease both',
        shake: 'shake 900ms cubic-bezier(.36,.07,.19,.97) both'
      }
    }
  },
  plugins: []
}
