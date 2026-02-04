/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          blue: '#A8D8EA',
          'blue-dark': '#7EC8E3',
          pink: '#FFCAD4',
          'pink-dark': '#F4A3B5',
          orange: '#FFD6A5',
          'orange-dark': '#FFBB70',
        }
      }
    },
  },
  plugins: [],
}
