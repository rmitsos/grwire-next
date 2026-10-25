import { SECTION_REDIRECTS } from "./config/section-redirects.js";

const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return SECTION_REDIRECTS;
  },
};

export default nextConfig;
