// Email-provider interface: { name, send({ to, subject, html, text, headers }) }.

export function createResendProvider({ apiKey, from, fetch: fetchImpl = globalThis.fetch }) {
  return {
    name: "resend",
    async send({ to, subject, html, text, headers }) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to: [to], subject, html, text, headers }),
      });
      if (!response.ok) {
        throw new Error(`Resend send failed with status ${response.status}`);
      }
      return response.json();
    },
  };
}

// Tracking (open/click) is a per-domain Resend setting, off by default. Call this before a
// bulk send so a domain that someone switched tracking on for doesn't silently break the
// "no tracking" promise in the landing copy.
export async function assertTrackingDisabled({ apiKey, domainId, fetch: fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(`https://api.resend.com/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Resend domain lookup failed with status ${response.status}`);
  }
  const domain = await response.json();
  if (domain.open_tracking || domain.click_tracking) {
    throw new Error("Resend open/click tracking is enabled for this domain");
  }
}
