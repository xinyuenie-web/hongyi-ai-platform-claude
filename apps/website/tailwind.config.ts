import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared/src/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1F3864',
          gold: '#BF8F00',
          red: '#C41E3A',
          green: {
            dark: '#2D4A2D',
            DEFAULT: '#4A7C59',
            light: '#8FBC8F',
          },
        },
      },
      fontFamily: {
        sans: [
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Hiragino Sans GB"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
