const ALGORITHM = "AES-GCM";
const IV_LENGTH_BYTES = 12;

async function importMasterKey(masterKeyBase64: string): Promise<CryptoKey> {
  const rawKey = base64Decode(masterKeyBase64);
  return crypto.subtle.importKey("raw", rawKey as BufferSource, ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * APIキーをAES-256-GCMで暗号化する。IVは呼び出しごとにランダム生成し、
 * AADにteacherIdを付与することでコンテキストバインディングを持たせる(design.md §4.2)。
 * 返り値は base64(iv(12byte) || ciphertext || authTag)。
 */
export async function encryptApiKey(params: {
  apiKey: string;
  teacherId: string;
  masterKeyBase64: string;
}): Promise<string> {
  const key = await importMasterKey(params.masterKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const additionalData = new TextEncoder().encode(params.teacherId);
  const plaintext = new TextEncoder().encode(params.apiKey);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, additionalData } as AesGcmParams,
    key,
    plaintext,
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return base64Encode(combined);
}

/** encryptApiKeyの逆操作。teacherIdが暗号化時と異なると認証タグ検証に失敗し例外を投げる */
export async function decryptApiKey(params: {
  encrypted: string;
  teacherId: string;
  masterKeyBase64: string;
}): Promise<string> {
  const key = await importMasterKey(params.masterKeyBase64);
  const combined = base64Decode(params.encrypted);
  const iv = combined.slice(0, IV_LENGTH_BYTES);
  const ciphertext = combined.slice(IV_LENGTH_BYTES);
  const additionalData = new TextEncoder().encode(params.teacherId);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, additionalData } as AesGcmParams,
    key,
    ciphertext as BufferSource,
  );

  return new TextDecoder().decode(plaintext);
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
