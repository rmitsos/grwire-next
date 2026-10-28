import "../globals.css";

export const metadata = {
  title: { default: "GR Wire", template: "%s | GR Wire" },
  description: "Greek telecom, energy and infrastructure news in one focused wire.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
