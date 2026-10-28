export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Search results run a database query per URL, so crawlers stay out of them.
      disallow: ["/intelligence", "/api", "/search?", "/en/search?"],
    },
  };
}
