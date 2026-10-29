import "./landing.css";
import { landingFontVariables } from "@/landing/fonts";
import { NOT_FOUND_LANG_SCRIPT } from "@/landing/not-found-lang";
import { NotFoundView } from "@/components/landing/NotFoundView";

// Required because the app has multiple root layouts (src/app/(site), (landing-el), (landing-en)):
// Next can't wrap a 404 in any one of them, so every 404 (unknown URL or notFound()) renders this
// page. It is branded (GR Wire header and footer) and exists in both languages in the HTML; a
// one-line script at the top of <body> sets <html lang> from the requested path before first paint
// and the CSS (landing.css, .nf-el / .nf-en) shows only that language. Without JS both show.
// See next.config.mjs experimental.globalNotFound.
export const metadata = {
  title: "GR Wire — Η σελίδα δεν βρέθηκε · Page not found",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="el" className={landingFontVariables} suppressHydrationWarning>
      <body className="landing">
        <script dangerouslySetInnerHTML={{ __html: NOT_FOUND_LANG_SCRIPT }} />
        <div className="nf-el">
          <NotFoundView lang="el" />
        </div>
        <div className="nf-en">
          <NotFoundView lang="en" />
        </div>
      </body>
    </html>
  );
}
