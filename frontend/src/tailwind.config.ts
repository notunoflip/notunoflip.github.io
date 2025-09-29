/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'selector', // Enable manual dark mode with class/attribute
  theme: {
    extend: {
      // You can extend the theme here if needed
    },
  },
  plugins: [],
}