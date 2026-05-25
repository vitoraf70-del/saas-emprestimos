import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const APP_NAME = "CrediarioMS";

export function generateTotpSecret() {
  return generateSecret();
}

export function buildTotpUri(email: string, secret: string) {
  return generateURI({
    issuer: APP_NAME,
    label: email,
    secret
  });
}

export async function buildTotpQrDataUrl(email: string, secret: string) {
  const uri = buildTotpUri(email, secret);
  return QRCode.toDataURL(uri);
}

export async function verifyTotpCode(code: string, secret: string) {
  const token = code.replace(/\D/g, "");
  if (token.length !== 6) return false;
  const result = await verify({ secret, token });
  return result.valid;
}
