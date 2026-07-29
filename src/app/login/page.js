export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const failed = params?.error === "1";
  const unavailable = params?.error === "config";

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">GR WIRE / PRIVATE</div>
        <h1>Market intelligence</h1>
        <p>Professional assessments and relationship intelligence are protected.</p>
        {failed && <p className="form-error">The password was not accepted.</p>}
        {unavailable && <p className="form-error">Dashboard authentication is not configured.</p>}
        <form action="/api/login" method="post">
          <label htmlFor="password">Private password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button type="submit">Enter dashboard</button>
        </form>
      </section>
    </main>
  );
}
