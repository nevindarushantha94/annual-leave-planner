/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F6F8',
        surface: '#FFFFFF',
        border: '#E1E4E9',
        ink: {
          DEFAULT: '#17212B',
          muted: '#62707E',
          faint: '#9AA6B2',
        },
        primary: {
          DEFAULT: '#1B3A4B',
          dark: '#102834',
          tint: '#E7EDF0',
        },
        accent: {
          DEFAULT: '#B5842A',
          tint: '#F6EEDD',
        },
        conflict: {
          DEFAULT: '#B33F36',
          tint: '#F7E7E5',
        },
        success: {
          DEFAULT: '#357A54',
          tint: '#E5F0EA',
        },
        hod: {
          DEFAULT: '#6B4E71',
          tint: '#EEE7EF',
        },
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '10px',
      },
      boxShadow: {
        panel: '0 8px 24px -8px rgba(23, 33, 43, 0.18)',
      },
    },
  },
  plugins: [],
}
