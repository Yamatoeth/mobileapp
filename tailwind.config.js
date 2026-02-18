/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0066ff',
        jarvis: {
          DEFAULT: '#00B4D8',
          accentAlt: '#FFB703',
          background: '#0A0A0A',
        },
      },
    },
  },
  plugins: [],
}

