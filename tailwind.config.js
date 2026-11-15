/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#101D2B',
          light: '#182A3E',
          dark: '#0A131D',
        },
        gold: {
          DEFAULT: '#C69A55',
          hover: '#B38844',
          soft: '#F9F4EB',
        },
        ivory: {
          DEFAULT: '#F5F3EE',
          dark: '#EAE6DD',
        },
        ink: {
          DEFAULT: '#172333',
          muted: '#718096',
        },
      },
      fontFamily: {
        sans: ['"Cairo"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        latin: ['"Plus Jakarta Sans"', '"Cairo"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
