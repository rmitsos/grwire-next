import "../landing.css";
import { landingFontVariables } from "@/landing/fonts";

export default function LandingEnLayout({ children }) {
  return (
    <html lang="en" className={landingFontVariables}>
      <body className="landing">{children}</body>
    </html>
  );
}
