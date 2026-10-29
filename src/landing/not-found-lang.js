// Greek is the default language; everything under /en is English.
export function langFromPathname(pathname) {
  const path = String(pathname || "").split(/[?#]/)[0];
  return path === "/en" || path.startsWith("/en/") ? "en" : "el";
}

// Runs in the browser before the 404 page paints: sets <html lang> from the URL so the CSS can hide
// the other language. Kept in step with langFromPathname above (a test runs both on the same paths).
export const NOT_FOUND_LANG_SCRIPT =
  '(function(){var p=location.pathname;document.documentElement.lang=(p==="/en"||p.indexOf("/en/")===0)?"en":"el";})();';
