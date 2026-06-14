/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Photography is served from the public Supabase Storage bucket. The app uses
  // plain <img> tags (see img() in src/data.ts), so no next/image remotePatterns
  // are required. Add them here if you switch to next/image later.
};

export default nextConfig;
