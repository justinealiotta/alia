import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  // Preflight (Tailwind's base reset) is intentionally DISABLED so Tailwind does
  // not alter the hand-authored Alia styles — the app ships its own reset in
  // styles/shell.css. Utilities stay available for new work; turn preflight back
  // on only if you drop the legacy CSS.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
