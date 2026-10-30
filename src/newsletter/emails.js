// Tareno-branded emails (confirmation, welcome, daily digest), EL and EN. Copy is from
// /workspace/knowledge/grwire/landing/subscribe-copy-v2.md. Inline styles only, no remote images,
// no tracking pixels, no third-party links: the only promotion is the plain Tareno Systems footer line.

const INK = "#0f172a";
const MUTED = "#64748b";
const ACCENT = "#0e7490";

export function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COPY = {
  el: {
    confirm: {
      subject: "Επιβεβαιώστε την εγγραφή σας στο GR Wire",
      greeting: "Γεια σας,",
      body: "Ζητήσατε να λαμβάνετε το GR Wire, ένα σύντομο email κάθε εργάσιμη για τα ελληνικά δίκτυα επικοινωνιών, την ενέργεια, τους διαγωνισμούς και τη ρύθμιση.",
      button: "Επιβεβαίωση εγγραφής",
      ignore: "Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το μήνυμα. Δεν θα λάβετε τίποτα άλλο.",
    },
    welcome: {
      subject: "Καλώς ήρθατε στο GR Wire",
      body: "Ευχαριστούμε που εγγραφήκατε. Κάθε εργάσιμη το πρωί θα λαμβάνετε ένα σύντομο email για τα ελληνικά δίκτυα επικοινωνιών, την ενέργεια, τους διαγωνισμούς και τη ρύθμιση. Κάθε είδηση με την πηγή της και λίγες γραμμές σχολίου. Χωρίς διαφημίσεις. Μπορείτε να διαγραφείτε με ένα κλικ από οποιοδήποτε email.",
    },
    digest: { subjectPrefix: "GR Wire", heading: "Δίκτυα, ενέργεια και διαγωνισμοί στην Ελλάδα σήμερα", comment: "Το σχόλιό μας", source: "Πηγή", readOriginal: "Πηγή" },
    footer: "Το GR Wire το εκδίδει η Tareno Systems (tarenosystems.com).",
    unsubscribe: "Διαγραφή",
    signoff: "GR Wire · Tareno Systems",
    byline: "από την Tareno Systems",
    locale: "el-GR",
  },
  en: {
    confirm: {
      subject: "Confirm your GR Wire subscription",
      greeting: "Hello,",
      body: "You asked to receive GR Wire, a short weekday email on Greek communication networks, energy, tenders and regulation.",
      button: "Confirm subscription",
      ignore: "If this wasn't you, just ignore this message and you won't hear from us again.",
    },
    welcome: {
      subject: "Welcome to GR Wire",
      body: "Thanks for subscribing. Every weekday morning you'll get a short email on Greek communication networks, energy, tenders and regulation. Each item comes with its source and a few lines of comment. No ads. You can unsubscribe with one click from any email.",
    },
    digest: { subjectPrefix: "GR Wire", heading: "Greek networks, energy and tenders today", comment: "Our comment", source: "Source", readOriginal: "Source" },
    footer: "GR Wire is published by Tareno Systems (tarenosystems.com).",
    unsubscribe: "Unsubscribe",
    signoff: "GR Wire · Tareno Systems",
    byline: "by Tareno Systems",
    locale: "en-GB",
  },
};

export const emailCopy = (lang) => COPY[lang === "en" ? "en" : "el"];

function layout({ lang, bodyHtml, unsubscribeUrl, siteUrl }) {
  const c = emailCopy(lang);
  const unsub = unsubscribeUrl
    ? ` <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">${c.unsubscribe}</a>`
    : "";
  return `<!doctype html>
<html lang="${lang === "en" ? "en" : "el"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px">
<tr><td style="padding:22px 28px;border-bottom:3px solid ${ACCENT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left" valign="middle"><a href="${escapeHtml(siteUrl)}" style="text-decoration:none"><img src="${escapeHtml(siteUrl)}/brand/email-logo.png" width="240" height="60" alt="GR Wire" style="display:block;border:0"></a></td>
<td align="right" valign="middle" style="font-size:13px;color:${MUTED}">${c.byline}</td>
</tr></table>
</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.55">${bodyHtml}</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:${MUTED}">
${escapeHtml(c.footer)}${unsub}
</td></tr>
</table></td></tr></table></body></html>`;
}

function footerText(lang, unsubscribeUrl) {
  const c = emailCopy(lang);
  return `--\n${c.footer}${unsubscribeUrl ? `\n${c.unsubscribe}: ${unsubscribeUrl}` : ""}`;
}

function button(url, label) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:6px;display:inline-block">${escapeHtml(label)}</a></p>`;
}

export function confirmationEmail({ lang, confirmUrl, unsubscribeUrl, siteUrl }) {
  const c = emailCopy(lang);
  const m = c.confirm;
  const bodyHtml = `<p style="margin:0 0 14px">${m.greeting}</p><p style="margin:0 0 14px">${m.body}</p>${button(confirmUrl, m.button)}
<p style="margin:0 0 14px;font-size:13px;color:${MUTED};word-break:break-all">${escapeHtml(confirmUrl)}</p>
<p style="margin:0 0 14px">${m.ignore}</p><p style="margin:0;font-weight:600">${c.signoff}</p>`;
  const text = `${c.signoff}\n\n${m.greeting}\n\n${m.body}\n\n${m.button}: ${confirmUrl}\n\n${m.ignore}\n\n${c.signoff}\n\n${footerText(lang, unsubscribeUrl)}`;
  return { subject: m.subject, html: layout({ lang, bodyHtml, unsubscribeUrl, siteUrl }), text };
}

export function welcomeEmail({ lang, unsubscribeUrl, siteUrl }) {
  const c = emailCopy(lang);
  const bodyHtml = `<p style="margin:0 0 14px">${c.welcome.body}</p><p style="margin:0;font-weight:600">${c.signoff}</p>`;
  const text = `${c.signoff}\n\n${c.welcome.body}\n\n${c.signoff}\n\n${footerText(lang, unsubscribeUrl)}`;
  return { subject: c.welcome.subject, html: layout({ lang, bodyHtml, unsubscribeUrl, siteUrl }), text };
}

function formatDate(iso, locale) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Athens" }).format(new Date(iso));
}

// stories: [{ title, url, sourceName, publishedAt, summary }], comment: optional plain text (one per language).
export function digestEmail({ lang, stories, comment, unsubscribeUrl, siteUrl, date = new Date() }) {
  const c = emailCopy(lang);
  const day = formatDate(date.toISOString(), c.locale);
  const subject = `${c.digest.subjectPrefix} · ${day}`;
  const commentHtml = comment
    ? `<div style="margin:0 0 22px;padding:14px 16px;background:#ecfeff;border-left:3px solid ${ACCENT}"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${ACCENT};margin-bottom:6px">${c.digest.comment}</div>${escapeHtml(comment).split(/\n{2,}/).map((p) => `<p style="margin:0 0 8px">${p.replace(/\n/g, "<br>")}</p>`).join("")}</div>`
    : "";
  const storiesHtml = stories.map((story) => {
    const meta = [story.sourceName, formatDate(story.publishedAt, c.locale)].filter(Boolean).join(" · ");
    return `<div style="margin:0 0 20px"><a href="${escapeHtml(story.url)}" style="font-size:17px;font-weight:700;line-height:1.35;color:${INK};text-decoration:none">${escapeHtml(story.title)}</a>${story.summary ? `<div style="margin-top:4px;color:#334155;font-size:15px">${escapeHtml(story.summary)}</div>` : ""}<div style="margin-top:4px;font-size:12px;color:${MUTED}">${c.digest.source}: ${escapeHtml(meta)}</div></div>`;
  }).join("");
  const bodyHtml = `<h1 style="margin:0 0 18px;font-size:20px">${c.digest.heading} · ${day}</h1>${commentHtml}${storiesHtml}<p style="margin:8px 0 0"><a href="${escapeHtml(siteUrl)}" style="color:${ACCENT}">grwire.com</a></p>`;
  const text = [
    `${c.signoff}\n`,
    `${c.digest.heading} · ${day}`,
    comment ? `\n${c.digest.comment}:\n${comment}` : "",
    "",
    ...stories.map((s) => `* ${s.title}\n  ${s.url}\n  ${c.digest.source}: ${[s.sourceName, formatDate(s.publishedAt, c.locale)].filter(Boolean).join(" · ")}${s.summary ? `\n  ${s.summary}` : ""}\n`),
    siteUrl,
    "",
    footerText(lang, unsubscribeUrl),
  ].join("\n");
  return { subject, html: layout({ lang, bodyHtml, unsubscribeUrl, siteUrl }), text };
}
