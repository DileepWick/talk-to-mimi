// tailwind.config.js
const {heroui} = require("@heroui/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./node_modules/@heroui/theme/dist/components/(button|ripple|spinner).js",
  ],
  theme: {
    extend: {
      fontFamily: {
        custom: ['f1', 'sans-serif'], // 'custom' is the Tailwind class name
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};