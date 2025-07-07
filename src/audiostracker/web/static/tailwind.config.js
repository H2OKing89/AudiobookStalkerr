/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../templates/**/*.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    // Disable Tailwind's base styles to prevent conflicts with Bootstrap/Tabler
    preflight: false,
  },
}

