import "./globals.css";

export const metadata = {
  title: "GR Wire Intelligence",
  description: "Private Greek market intelligence dashboard",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
