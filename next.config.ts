import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{
      source: "/catalog.pdf",
      destination: "https://2m1pnldlflkr6kq2.public.blob.vercel-storage.com/catalog-PeWkrDyDfjoqlAO7JcVz3nP5lNhhxp.pdf",
      permanent: false,
    }];
  },
};

export default nextConfig;
