import { SECTION_REDIRECTS } from "./config/section-redirects.js";

const nextConfig = {
  poweredByHeader: false,
  // Landing (EL/EN) and the main site are separate root layouts (route groups), so there's
  // no single root layout left to compose a 404 page for URLs that match no group at all.
  experimental: {
    globalNotFound: true,
  },
  async redirects() {
    return SECTION_REDIRECTS;
  },
};

export default nextConfig;
