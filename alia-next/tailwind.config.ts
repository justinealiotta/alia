import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  // Preflight (Tailwind's base reset) is intentionally DISABLED so Tailwind does
  // not alter the existing hand-authored Alia styles — the app ships its own
  // reset in shared/shell.css. All Tailwind utilities/components stay available
  // for new work; turn preflight back on only if you drop the legacy CSS.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
