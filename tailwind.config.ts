import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          bg: 'rgba(15, 18, 35, 0.6)',
          border: 'rgba(59, 130, 246, 0.15)',
          'border-hover': 'rgba(59, 130, 246, 0.45)',
        },
        accent: {
          blue: '#3B82F6',
          'blue-light': '#60A5FA',
          'blue-dark': '#2563EB',
          'blue-deep': '#1E3A8A',
          green: '#10B981',
          red: '#EF4444',
          yellow: '#F59E0B',
          orange: '#F97316',
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
        },
        surface: {
          DEFAULT: '#0A0A0F',
          light: 'rgba(15, 18, 35, 0.6)',
          lighter: 'rgba(30, 41, 65, 0.5)',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          label: '#CBD5E1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backdropBlur: {
        glass: '40px',
      },
      borderRadius: {
        glass: '16px',
      },
      boxShadow: {
        glass:
          '0 0 20px rgba(59, 130, 246, 0.06), inset 0 1px 0 rgba(59, 130, 246, 0.1)',
        'glass-hover':
          '0 0 30px rgba(59, 130, 246, 0.12), 0 0 60px rgba(59, 130, 246, 0.04), inset 0 1px 0 rgba(59, 130, 246, 0.2)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1E3A8A, #3B82F6)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))',
        'gradient-glow':
          'radial-gradient(circle at 30% 50%, rgba(59, 130, 246, 0.08), transparent 70%)',
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        glass: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
