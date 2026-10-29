// Raw MIME builder for SES (SendEmail with Content.Raw), so List-Unsubscribe headers and a
// Reply-To go out exactly as written. No dependencies.

function encodeWord(value) {
  // RFC 2047 only when needed (non-ASCII).
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatAddress(name, address) {
  if (!name) return address;
  const encoded = encodeWord(name);
  const display = encoded === name ? `"${name.replace(/(["\\])/g, "\\$1")}"` : encoded;
  return `${display} <${address}>`;
}

function chunk76(base64) {
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function assertNoLineBreaks(label, value) {
  if (/[\r\n]/.test(String(value))) throw new Error(`Invalid ${label}: contains a line break`);
}

export function buildRawEmail({ from, fromName, to, replyTo, subject, html, text, headers = {}, messageId, date = new Date() }) {
  for (const [label, value] of Object.entries({ from, fromName: fromName || "", to, replyTo: replyTo || "", subject })) {
    assertNoLineBreaks(label, value);
  }
  for (const [name, value] of Object.entries(headers)) {
    assertNoLineBreaks(`header ${name}`, name);
    assertNoLineBreaks(`header ${name}`, value);
  }
  const boundary = `grwire-${Buffer.from(String(messageId || Math.random())).toString("hex").slice(0, 24)}`;
  const lines = [
    `From: ${formatAddress(fromName, from)}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeWord(subject)}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    "MIME-Version: 1.0",
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunk76(Buffer.from(text, "utf8").toString("base64")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunk76(Buffer.from(html, "utf8").toString("base64")),
    `--${boundary}--`,
    "",
  ];
  return lines.join("\r\n");
}
