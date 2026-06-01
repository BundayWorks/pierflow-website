import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0a0a0a",
          surface: "#111111",
          border: "#1e1e1e",
          muted: "#1a1a1a",
        },
        accent: {
          green: "#0DCE9A",
          "green-dim": "#0DCE9A18",
          teal: "#0A7C6E",
          "teal-light": "#E1F5EE",
          lime: "#A8F2A1",
          mint: "#7AE7C7",
          cyan: "#5BE9E0",
          emerald: "#048B68",
          deep: "#063A33",
          ink: "#0A1F1B",
        },
        card: {
          mint: "#E6FBF3",
          sky: "#E8F6FB",
          lilac: "#EEF1FB",
        },
        textd: {
          primary: "#FFFFFF",
          secondary: "#888888",
          muted: "#555555",
          tealish: "#A8DDD8",
        },
        textl: {
          primary: "#111111",
          secondary: "#555555",
        },
        bgl: {
          DEFAULT: "#FFFFFF",
          alt: "#F7F7F7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
        xl: "16px",
      },
      maxWidth: {
        content: "860px",
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
        "hero-gradient":
          "linear-gradient(135deg, #063A33 0%, #0A7C6E 32%, #0DCE9A 68%, #7AE7C7 100%)",
        "headline-gradient":
          "linear-gradient(90deg, #A8F2A1 0%, #7AE7C7 30%, #FFFFFF 70%)",
        "card-mint":
          "linear-gradient(135deg, #E6FBF3 0%, #D6F5EC 50%, #C9EFE2 100%)",
        "card-sky":
          "linear-gradient(135deg, #E8F6FB 0%, #DDF1FA 50%, #D2EBF8 100%)",
        "cta-gradient":
          "linear-gradient(135deg, #0A7C6E 0%, #0DCE9A 50%, #7AE7C7 100%)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
