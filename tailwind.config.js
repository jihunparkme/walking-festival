/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Noto Sans KR", "Pretendard", "Apple SD Gothic Neo", "sans-serif"],
      },
      colors: {
        candyPink: "#ffd9e8",
        skyMint: "#dff6ff",
        creamSun: "#fff4c2",
        limeCloud: "#e8f8d8",
        ink: "#3a3a4a",
      },
      boxShadow: {
        soft: "0 14px 30px rgba(58, 58, 74, 0.12)",
      },
      borderRadius: {
        bubble: "2rem",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        bob: "bob 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
