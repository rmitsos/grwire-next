"use client";

export default function ErrorPage({ reset }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">GR WIRE / PRIVATE</div>
        <h1>Something went wrong</h1>
        <p>The private data was not changed. Try loading the dashboard again.</p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
