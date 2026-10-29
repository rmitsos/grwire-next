// Amazon SES v2 provider. Provider interface: { name, send({ to, subject, html, text, headers }) }.
// SigV4 is implemented with node:crypto (the repo has no AWS SDK dependency). Credentials are the
// static AWS_SES_* pair: an IAM user that may only call ses:SendEmail on the one identity with a
// ses:FromAddress condition (see docs/golive/ses-iam-policy.json). Secrets never appear in errors.
import { createHash, createHmac } from "node:crypto";
import { buildRawEmail, formatAddress } from "./mime.js";

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

export function signRequest({ method, host, path, region, service = "ses", body, accessKeyId, secretAccessKey, sessionToken, now = new Date() }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const headers = {
    "content-type": "application/json",
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(sessionToken ? { "x-amz-security-token": sessionToken } : {}),
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function createSesProvider({
  accessKeyId, secretAccessKey, region = "eu-central-1", from, fromName = "GR Wire", replyTo = null,
  configurationSetName = null, fetch: fetchImpl = globalThis.fetch, now = () => new Date(),
}) {
  const host = `email.${region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  return {
    name: "ses",
    async send({ to, subject, html, text, headers, tag }) {
      const date = now();
      const raw = buildRawEmail({ from, fromName, to, replyTo, subject, html, text, headers, date, messageId: `${to}${date.getTime()}` });
      const body = JSON.stringify({
        // Display name here too: SES shows this value as From, whatever the raw message header says.
        FromEmailAddress: formatAddress(fromName, from),
        Destination: { ToAddresses: [to] },
        Content: { Raw: { Data: Buffer.from(raw, "utf8").toString("base64") } },
        ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
        ...(tag ? { EmailTags: [{ Name: "type", Value: tag }] } : {}),
      });
      const signed = signRequest({ method: "POST", host, path, region, body, accessKeyId, secretAccessKey, now: date });
      const { host: _host, ...requestHeaders } = signed;
      const response = await fetchImpl(`https://${host}${path}`, { method: "POST", headers: requestHeaders, body });
      if (!response.ok) {
        let code = "";
        try {
          const detail = await response.json();
          code = detail?.__type || detail?.message || "";
        } catch { /* not JSON */ }
        throw new Error(`SES send failed with status ${response.status}${code ? ` (${String(code).slice(0, 80)})` : ""}`);
      }
      return response.json();
    },
  };
}
