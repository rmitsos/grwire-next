import Link from "next/link";
import { getNavVisibility } from "@/public-data";

// sources-spec.md round-4 §7: /tenders and /regulators stay out of the nav
// until their section has >=3 items in the last 30 days (getNavVisibility);
// the pages themselves still resolve either way. Tenders is listed first
// among these two, consistent with the rest of the nav order.
export async function PublicHeader() {
  const navVisibility = await getNavVisibility();
  return (
    <header className="public-header">
      <Link className="brand" href="/">
        <strong>GR</strong><span>WIRE</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/deals">Deals &amp; companies</Link>
        <Link href="/telco">Telecom</Link>
        <Link href="/energy">Energy</Link>
        <Link href="/infrastructure">Infrastructure</Link>
        {navVisibility.tenders.shown && <Link href="/tenders">Tenders</Link>}
        {navVisibility.regulators.shown && <Link href="/regulators">Regulators</Link>}
        <Link href="/search">Search</Link>
      </nav>
      <Link className="intelligence-link" href="/intelligence">Private intelligence</Link>
    </header>
  );
}
