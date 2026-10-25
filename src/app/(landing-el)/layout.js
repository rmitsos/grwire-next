import "../landing.css";
import { landingFontVariables } from "@/landing/fonts";

export default function LandingElLayout({ children }) {
  return (
    <html lang="el" className={landingFontVariables}>
      <body className="landing">{children}</body>
    </html>
  );
}
