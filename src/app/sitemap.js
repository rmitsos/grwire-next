export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://grwire.com";
  return ["", "/finance", "/telco", "/energy", "/infrastructure", "/search"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path ? "hourly" : "always",
    priority: path ? 0.8 : 1,
  }));
}
