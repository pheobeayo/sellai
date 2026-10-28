/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native/binary packages must load from node_modules at runtime, not be bundled.
  serverExternalPackages: ["sharp", "ffmpeg-static"],
};
export default nextConfig;
