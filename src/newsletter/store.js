let schemaPromise;

export async function ensureSubscriberSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = createSubscriberSchema(sql).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

async function createSubscriberSchema(sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`
    CREATE TABLE IF NOT EXISTS subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
      lang TEXT NOT NULL DEFAULT 'el' CHECK (lang IN ('el', 'en')),
      consent_text_version TEXT NOT NULL,
      consented_at TIMESTAMPTZ NOT NULL,
      source_page TEXT,
      confirm_token_hash TEXT,
      confirm_sent_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      unsubscribe_token_hash TEXT UNIQUE,
      unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_idx ON subscribers (email)`;
  await sql`CREATE INDEX IF NOT EXISTS subscribers_status_created_idx ON subscribers (status, created_at)`;
  // One row per subscriber per send date: the primary key is what makes the daily send idempotent.
  await sql`
    CREATE TABLE IF NOT EXISTS digest_sends (
      subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      send_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ,
      PRIMARY KEY (subscriber_id, send_date)
    )
  `;
  // Optional editor comment for a given day's email (one text per language).
  await sql`
    CREATE TABLE IF NOT EXISTS digest_comments (
      send_date DATE PRIMARY KEY,
      comment_el TEXT,
      comment_en TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

// Expects `email` already lowercased/trimmed by the caller (see newsletter/service.js#validateEmail).
export function createSubscriberStore(sql) {
  return {
    // A repeat for the same pending address within 2 minutes (double click, retry) keeps the row, and its
    // confirmation token, exactly as it was and returns issued = false: the caller sends no second email.
    // The check lives in the single SQL statement, so two simultaneous requests can't both issue a token.
    async upsertPending({ email, lang, consentTextVersion, sourcePage, confirmTokenHash, unsubscribeTokenHash }) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`
        INSERT INTO subscribers (
          email, status, lang, consent_text_version, consented_at, source_page,
          confirm_token_hash, confirm_sent_at, unsubscribe_token_hash
        )
        VALUES (
          ${email}, 'pending', ${lang}, ${consentTextVersion}, now(), ${sourcePage || null},
          ${confirmTokenHash}, now(), ${unsubscribeTokenHash}
        )
        ON CONFLICT (email) DO UPDATE SET
          status = CASE WHEN subscribers.status = 'confirmed' THEN subscribers.status ELSE 'pending' END,
          lang = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.lang ELSE EXCLUDED.lang END,
          consent_text_version = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.consent_text_version ELSE EXCLUDED.consent_text_version END,
          consented_at = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.consented_at ELSE EXCLUDED.consented_at END,
          source_page = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.source_page ELSE EXCLUDED.source_page END,
          confirm_token_hash = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.confirm_token_hash ELSE EXCLUDED.confirm_token_hash END,
          confirm_sent_at = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.confirm_sent_at ELSE EXCLUDED.confirm_sent_at END,
          unsubscribe_token_hash = CASE WHEN (subscribers.status = 'confirmed' OR (subscribers.status = 'pending' AND subscribers.confirm_sent_at > now() - INTERVAL '2 minutes'))
            THEN subscribers.unsubscribe_token_hash ELSE EXCLUDED.unsubscribe_token_hash END,
          unsubscribed_at = CASE WHEN subscribers.status = 'confirmed' THEN subscribers.unsubscribed_at ELSE NULL END,
          updated_at = now()
        RETURNING id, email, status, lang, (confirm_sent_at = now()) AS issued
      `;
      return rows[0];
    },

    async confirmByTokenHash(hash, { maxAgeDays = 7 } = {}) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`
        UPDATE subscribers
        SET status = 'confirmed', confirmed_at = now(), updated_at = now()
        WHERE confirm_token_hash = ${hash}
          AND status = 'pending'
          AND confirm_sent_at >= now() - (${maxAgeDays} * INTERVAL '1 day')
        RETURNING id, email, lang
      `;
      return rows[0] || null;
    },

    // Read-only: what became of a confirm link that confirmByTokenHash did not accept.
    async findByConfirmTokenHash(hash) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`SELECT status, lang FROM subscribers WHERE confirm_token_hash = ${hash}`;
      return rows[0] || null;
    },

    // Read-only, for the unsubscribe page: 'active' | 'unsubscribed' | 'invalid'.
    async unsubscribeStateByTokenHash(hash) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`SELECT status FROM subscribers WHERE unsubscribe_token_hash = ${hash}`;
      if (!rows[0]) return "invalid";
      return rows[0].status === "unsubscribed" ? "unsubscribed" : "active";
    },

    async unsubscribeByTokenHash(hash) {
      await ensureSubscriberSchema(sql);
      const updated = await sql`
        UPDATE subscribers
        SET status = 'unsubscribed', unsubscribed_at = now(), updated_at = now()
        WHERE unsubscribe_token_hash = ${hash} AND status <> 'unsubscribed'
        RETURNING id
      `;
      if (updated[0]) return { found: true, already: false };
      const existing = await sql`SELECT id FROM subscribers WHERE unsubscribe_token_hash = ${hash}`;
      return { found: Boolean(existing[0]), already: Boolean(existing[0]) };
    },

    // Run daily by /api/cron/newsletter-cleanup: unconfirmed sign-ups are deleted after 7 days.
    async deleteStalePending({ olderThanDays = 7 } = {}) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`
        DELETE FROM subscribers
        WHERE status = 'pending'
          AND confirm_sent_at < now() - (${olderThanDays} * INTERVAL '1 day')
        RETURNING id
      `;
      return rows.length;
    },

    // Confirmed subscribers who confirmed before the start (Athens time) of `sendDate`, so the
    // welcome email's "from tomorrow morning" is true.
    async listConfirmed({ sendDate } = {}) {
      await ensureSubscriberSchema(sql);
      if (!sendDate) {
        return sql`SELECT id, email, lang, status FROM subscribers WHERE status = 'confirmed' ORDER BY created_at ASC`;
      }
      return sql`
        SELECT id, email, lang, status
        FROM subscribers
        WHERE status = 'confirmed'
          AND confirmed_at < ((${sendDate}::date)::timestamp AT TIME ZONE 'Europe/Athens')
        ORDER BY created_at ASC
      `;
    },

    // true = this caller owns the send for (subscriber, date). A 'sent' or 'sending' row is never
    // claimed again; only a 'failed' one is retried.
    async claimDigestSend(subscriberId, sendDate) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`
        INSERT INTO digest_sends (subscriber_id, send_date, status)
        VALUES (${subscriberId}, ${sendDate}::date, 'sending')
        ON CONFLICT (subscriber_id, send_date) DO UPDATE
          SET status = 'sending', attempted_at = now()
          WHERE digest_sends.status = 'failed'
        RETURNING subscriber_id
      `;
      return rows.length === 1;
    },

    async markDigestSend(subscriberId, sendDate, status) {
      await ensureSubscriberSchema(sql);
      await sql`
        UPDATE digest_sends
        SET status = ${status}, sent_at = CASE WHEN ${status} = 'sent' THEN now() ELSE NULL END
        WHERE subscriber_id = ${subscriberId} AND send_date = ${sendDate}::date
      `;
    },

    async getDigestComment(sendDate) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`SELECT comment_el, comment_en FROM digest_comments WHERE send_date = ${sendDate}::date`;
      return rows[0] ? { el: rows[0].comment_el || null, en: rows[0].comment_en || null } : { el: null, en: null };
    },
  };
}
