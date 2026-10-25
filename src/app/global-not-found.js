// Required because the app now has multiple root layouts (src/app/(site), (landing-el),
// (landing-en)) — there's no single layout Next can compose a 404 page from for a URL that
// matches none of them. See next.config.mjs experimental.globalNotFound.
export const metadata = {
  title: "GR Wire · Page not found",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#f3f2ec",
          color: "#10211b",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Page not found</h1>
          <p style={{ margin: "0 0 20px", color: "#69766f" }}>The page you are looking for does not exist.</p>
          <a href="/" style={{ color: "#0c6b4f", fontWeight: 700, textDecoration: "none" }}>
            Back to GR Wire →
          </a>
        </div>
      </body>
    </html>
  );
}
