module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          light: '#52B788',
        },
        accent: '#F4A261',
        surface: '#FFFFFF',
        background: '#FAFDF7',
        muted: '#F3F7F0',
        text: {
          primary: '#1B1B1B',
          secondary: '#6B7280',
        },
        status: {
          healthy: '#16A34A',
          error: '#DC2626',
          warning: '#F59E0B',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.04)',
        'md': '0 4px 12px rgba(0,0,0,0.06)',
      },
      maxWidth: {
        'content': '1180px',
      },
    },
  },
  plugins: [],
}