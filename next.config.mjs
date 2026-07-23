/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Photography is served from the public Supabase Storage bucket via plain
  // <img> tags (see img() in src/data.ts) — no next/image remotePatterns needed.
  //
  // The sticker cut-out loader pulls @imgly/background-removal from esm.sh through
  // a runtime dynamic import() marked /* webpackIgnore: true */, so the bundler
  // leaves it as a native browser import (no npm dep required).
};

export default nextConfig;
