import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "./crypto";

// AES-256-GCMのため32byteの鍵をbase64化したもの
const MASTER_KEY_BASE64 = Buffer.from("0".repeat(32)).toString("base64");
const OTHER_MASTER_KEY_BASE64 = Buffer.from("1".repeat(32)).toString("base64");

describe("encryptApiKey / decryptApiKey", () => {
  it("暗号化/復号の往復で元のAPIキーに戻る(T-028)", async () => {
    const encrypted = await encryptApiKey({
      apiKey: "sk-test-1234567890",
      teacherId: "teacher-1",
      masterKeyBase64: MASTER_KEY_BASE64,
    });

    expect(encrypted).not.toContain("sk-test-1234567890");

    const decrypted = await decryptApiKey({
      encrypted,
      teacherId: "teacher-1",
      masterKeyBase64: MASTER_KEY_BASE64,
    });

    expect(decrypted).toBe("sk-test-1234567890");
  });

  it("暗号化のたびに異なるIVが使われ、暗号文が毎回変わる", async () => {
    const first = await encryptApiKey({
      apiKey: "sk-test",
      teacherId: "teacher-1",
      masterKeyBase64: MASTER_KEY_BASE64,
    });
    const second = await encryptApiKey({
      apiKey: "sk-test",
      teacherId: "teacher-1",
      masterKeyBase64: MASTER_KEY_BASE64,
    });
    expect(first).not.toBe(second);
  });

  it("AAD(teacherId)が異なると復号に失敗する(コンテキストバインディング)", async () => {
    const encrypted = await encryptApiKey({
      apiKey: "sk-test",
      teacherId: "teacher-1",
      masterKeyBase64: MASTER_KEY_BASE64,
    });

    await expect(
      decryptApiKey({ encrypted, teacherId: "teacher-2", masterKeyBase64: MASTER_KEY_BASE64 }),
    ).rejects.toThrow();
  });

  it("マスターキーが異なると復号に失敗する", async () => {
    const encrypted = await encryptApiKey({
      apiKey: "sk-test",
      teacherId: "teacher-1",
      masterKeyBase64: MASTER_KEY_BASE64,
    });

    await expect(
      decryptApiKey({
        encrypted,
        teacherId: "teacher-1",
        masterKeyBase64: OTHER_MASTER_KEY_BASE64,
      }),
    ).rejects.toThrow();
  });
});
