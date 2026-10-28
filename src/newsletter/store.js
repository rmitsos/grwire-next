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
}

// Expects `email` already lowercased/trimmed by the caller (see newsletter/service.js#validateEmail).
export function createSubscriberStore(sql) {
  return {
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
          lang = CASE WHEN subscribers.status = 'confirmed' THEN subscribers.lang ELSE EXCLUDED.lang END,
          consent_text_version = CASE WHEN subscribers.status = 'confirmed'
            THEN subscribers.consent_text_version ELSE EXCLUDED.consent_text_version END,
          consented_at = CASE WHEN subscribers.status = 'confirmed'
            THEN subscribers.consented_at ELSE EXCLUDED.consented_at END,
          source_page = CASE WHEN subscribers.status = 'confirmed'
            THEN subscribers.source_page ELSE EXCLUDED.source_page END,
          confirm_token_hash = CASE WHEN subscribers.status = 'confirmed'
            THEN subscribers.confirm_token_hash ELSE EXCLUDED.confirm_token_hash END,
          confirm_sent_at = CASE WHEN subscribers.status = 'confirmed'
            THEN subscribers.confirm_sent_at ELSE EXCLUDED.confirm_sent_at END,
          unsubscribe_token_hash = CASE WHEN subscribers.status = 'confirmed'
            THEN subscribers.unsubscribe_token_hash ELSE EXCLUDED.unsubscribe_token_hash END,
          unsubscribed_at = CASE WHEN subscribers.status = 'confirmed' THEN subscribers.unsubscribed_at ELSE NULL END,
          updated_at = now()
        RETURNING id, email, status, lang
      `;
      return rows[0];
    },

    async confirmByTokenHash(hash, { maxAgeDays = 7 } = {}) {
      await ensureSubscriberSchema(sql);
      const rows = await sql`
        UPDATE subscribers
        SET status = 'confirmed', confirmed_at = now(), confirm_token_hash = NULL, updated_at = now()
        WHERE confirm_token_hash = ${hash}
          AND status = 'pending'
          AND confirm_sent_at >= now() - (${maxAgeDays} * INTERVAL '1 day')
        RETURNING id, email, lang
      `;
      return rows[0] || null;
    },

    async unsubscribeByTokenHash(hash) {
      await ensureSubscriberSchema(sql);
      const updated = await sql`
        UPDATE subscribers
        SET status = 'unsubscribed', unsubscribed_at = now(), updated_at = now()
        WHERE unsubscribe_token_hash = ${hash} AND status <> 'unsubscribed'
        RETURNING id
      `;
      if (updated[0]) return { found: true };
      const existing = await sql`SELECT id FROM subscribers WHERE unsubscribe_token_hash = ${hash}`;
      return { found: Boolean(existing[0]) };
    },

    // Not scheduled by any cron; call manually or wire up a future job.
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

    async listConfirmed() {
      await ensureSubscriberSchema(sql);
      return sql`
        SELECT id, email, lang, unsubscribe_token_hash
        FROM subscribers
        WHERE status = 'confirmed'
        ORDER BY created_at ASC
      `;
    },

    // A weekly sender issues a fresh unsubscribe token per send (tokens are stored hashed,
    // so the raw token can't be recovered later) via rotateUnsubscribeToken(id, hash).
    async rotateUnsubscribeToken(id, hash) {
      await ensureSubscriberSchema(sql);
      await sql`UPDATE subscribers SET unsubscribe_token_hash = ${hash}, updated_at = now() WHERE id = ${id}`;
    },
  };
}
