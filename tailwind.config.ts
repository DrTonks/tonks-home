import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // 品牌色：深天蓝 + 薄荷绿 + 琥珀点缀
        brand: {
          sky: 'hsl(var(--color-sky))',
          'sky-bright': 'hsl(var(--color-sky-bright))',
          'sky-deep': 'hsl(var(--color-sky-deep))',
          'sky-soft': 'hsl(var(--color-sky-soft))',
          mint: 'hsl(var(--color-mint))',
          'mint-soft': 'hsl(var(--color-mint-soft))',
          'mint-deep': 'hsl(var(--color-mint-deep))',
          amber: 'hsl(var(--color-amber))',
          'amber-soft': 'hsl(var(--color-amber-soft))',
          violet: 'hsl(var(--color-violet))',
          silver: 'hsl(var(--color-silver))',
          link: 'hsl(var(--color-link))',
        },
      },
      fontFamily: {
        sans: ['Geist Sans', 'PingFang SC', '思源黑体', 'system-ui', 'sans-serif'],
        kai: ['KaiTi', 'STKaiti', 'SimKai', 'Kai', '楷体', 'cursive'],  // 系统楷体
        heavy: ['"Smiley Sans"', 'sans-serif'],             // 得意黑
        script: ['Caveat', 'cursive'],                      // 英文花体
        mono: ['JetBrains Mono', 'Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        'glow-primary': 'var(--shadow-glow-primary)',
        'glow-secondary': 'var(--shadow-glow-secondary)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        spiral: 'var(--duration-spiral)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out)',
        'in-expo': 'var(--ease-in)',
        spring: 'var(--ease-spring)',
        smooth: 'var(--ease-smooth)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.08)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(-360deg)' },
        },
        'float-soft': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 12s linear infinite',
        'float-soft': 'float-soft 5s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config
