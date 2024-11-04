/* eslint-env node */

const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ["./index.html", "./src/**/*.{gleam,mjs}"],
  theme: {},
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

