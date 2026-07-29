import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="brand" href="/">
        <strong>GR</strong><span>WIRE</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/finance">Finance</Link>
        <Link href="/telco">Telecom</Link>
        <Link href="/energy">Energy</Link>
        <Link href="/infrastructure">Infrastructure</Link>
        <Link href="/search">Search</Link>
      </nav>
      <Link className="intelligence-link" href="/intelligence">Private intelligence</Link>
    </header>
  );
}
