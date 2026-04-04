/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sawa brand palette — inspired by KSA desert tones + professionalism
        brand: {
          50:  "#fdf6ee",
          100: "#faebd7",
          200: "#f3d5ae",
          300: "#eab97d",
          400: "#e09548",
          500: "#d97c2a",  // primary amber/gold
          600: "#c56220",
          700: "#a44a1a",
          800: "#843c1c",
          900: "#6b321a",
        },
        sage: {
          50:  "#f4f7f4",
          100: "#e6ede6",
          200: "#cddccd",
          300: "#a9c2a9",
          400: "#7ea37e",
          500: "#5e875e",  // secondary sage green
          600: "#496b49",
          700: "#3c553c",
          800: "#324532",
          900: "#2a392a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        arabic: ["Cairo", "Noto Sans Arabic", "sans-serif"],
      },
    },
  },
  plugins: [],
};
