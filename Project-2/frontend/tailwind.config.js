/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        garmin: {
          blue: '#007cc3',
          dark: '#1e1e1e',
          gray: '#f4f4f4',
          lightGray: '#ffffff',
          textDark: '#333333',
          textMuted: '#666666'
        }
      }
    },
  },
  plugins: [],
}
