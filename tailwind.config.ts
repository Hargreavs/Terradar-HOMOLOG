import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terrae: {
          50: '#FAEEDA',
          100: '#FAC775',
          200: '#EF9F27',
          400: '#BA7517',
          600: '#854F0B',
          800: '#633806',
          900: '#412402',
        },
        dark: {
          primary: '#0D0D0C',
          secondary: '#111110',
          tertiary: '#1A1A18',
          border: '#2C2C2A',
        },
      },
    },
  },
} satisfies Config
