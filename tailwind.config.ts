import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-dm-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        "mkt-bg": "var(--mkt-bg)",
        "mkt-surface": "var(--mkt-surface)",
        "mkt-blue": "var(--mkt-blue)",
        "mkt-blue-light": "var(--mkt-blue-light)",
        "mkt-text": "var(--mkt-text)",
        "mkt-text-secondary": "var(--mkt-text-secondary)",
        "mkt-border": "var(--mkt-border)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          cyan: "hsl(var(--accent-cyan))",
          violet: "hsl(var(--accent-violet))",
          rose: "hsl(var(--accent-rose))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        navy: "hsl(var(--navy))",
        ivory: "hsl(var(--ivory))",
        gold: "hsl(var(--gold))",
        charcoal: "hsl(var(--charcoal))",
        stone: "hsl(var(--stone))",
        surface: {
          0: "hsl(var(--surface-0))",
          50: "hsl(var(--surface-50))",
          secondary: "hsl(var(--surface-secondary))",
          muted: "hsl(var(--surface-muted))",
        },
        text: {
          primary: "hsl(var(--text-primary))",
          secondary: "hsl(var(--text-secondary))",
          tertiary: "hsl(var(--text-tertiary))",
        },
        dash: {
          bg: "hsl(var(--dash-bg) / <alpha-value>)",
          surface: "hsl(var(--dash-surface) / <alpha-value>)",
          "surface-subtle": "hsl(var(--dash-surface-subtle) / <alpha-value>)",
          border: "hsl(var(--dash-border) / <alpha-value>)",
          "border-strong": "hsl(var(--dash-border-strong) / <alpha-value>)",
          text: "hsl(var(--dash-text) / <alpha-value>)",
          muted: "hsl(var(--dash-text-muted) / <alpha-value>)",
          faint: "hsl(var(--dash-text-faint) / <alpha-value>)",
          ring: "hsl(var(--dash-ring) / <alpha-value>)",
        },
      },
      ringOffsetColor: {
        surface: "hsl(var(--surface-50))",
        "dash-surface": "hsl(var(--dash-surface))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.08), 0 18px 40px rgba(15, 23, 42, 0.06)",
        "card-hover": "0 10px 28px rgba(15, 23, 42, 0.12)",
        elegant: "0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.08)",
        "elegant-lg": "0 16px 40px rgba(15, 23, 42, 0.14)",
        soft: "0 8px 24px rgba(15, 23, 42, 0.08)",
        "soft-lg": "0 18px 48px rgba(15, 23, 42, 0.12)",
        gold: "0 18px 45px rgba(37, 99, 235, 0.16)",
        glow:
          "0 0 0 1px rgba(255, 255, 255, 0.06), 0 4px 24px rgba(124, 58, 237, 0.28)",
        dash: "var(--dash-shadow)",
        "dash-raised": "var(--dash-shadow-raised)",
      },
      backgroundImage: {
        "gradient-hero":
          "linear-gradient(180deg, rgba(2, 6, 23, 0.22) 0%, rgba(2, 6, 23, 0.72) 50%, rgba(2, 6, 23, 0.96) 100%)",
        "grid-overlay":
          "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
        "gradient-accent":
          "linear-gradient(135deg, hsl(var(--accent-violet)) 0%, hsl(var(--primary)) 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
