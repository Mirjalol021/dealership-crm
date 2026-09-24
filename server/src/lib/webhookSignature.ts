import crypto from 'node:crypto';

// Constant-time comparison of two hex/base64 strings.
function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Validates Meta's X-Hub-Signature-256 header against the raw request body (§56).
// Meta computes: sha256=<HMAC-SHA256(appSecret, rawBody)>
export function verifyMetaSignature(
  rawBody: string | Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return false; // secret not configured -> cannot trust
  if (!rawBody || !signatureHeader) return false;

  const [scheme, provided] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !provided) return false;

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)
    .digest('hex');

  return timingSafeEqualHex(provided, expected);
}
