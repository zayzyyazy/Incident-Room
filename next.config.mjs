import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/** Next.js does not auto-load .env.band.local — merge it for Band sync in dev. */
const bandPath = path.join(process.cwd(), ".env.band.local");
if (fs.existsSync(bandPath)) {
  dotenv.config({ path: bandPath, override: false });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/presentation",
        destination: "/presentation/index.html",
      },
    ];
  },
};

export default nextConfig;
