import { afterEach, describe, it, expect, vi } from "vitest";
import { database } from "./database";
import { translate } from "../lib/translation";
import { validate } from "../lib/domain";
import { handle } from "../lib/service";
const db = database();
afterEach(async () => {
  await db.prepare("DELETE FROM records").run();
  await db.prepare("DELETE FROM limits").run();
});
const answer = (text = "Sannu") =>
  Response.json({
    responseStatus: 200,
    responseData: { translatedText: text },
  });
describe("language translation", () => {
  it("translates Hausa via the configured service", async () => {
    const f = vi.fn(async (_url: any) => answer());
    const r = await translate("Hello", "en", "ha", db, {}, f);
    expect(r.text).toBe("Sannu");
    expect(r.reviewed).toBe(false);
    expect(
      new URL(String(f.mock.calls[0][0])).searchParams.get("langpair"),
    ).toBe("en|ha");
  });
  it("rejects unsupported language codes and oversized input", async () => {
    await expect(translate("Hello", "en", "xxx", db)).rejects.toThrow(
      "supported languages",
    );
    await expect(translate("é".repeat(1300), "en", "ha", db)).rejects.toThrow(
      "bytes",
    );
  });
  it("does not fabricate Idoma translations or send them to an unsupported provider", async () => {
    const f = vi.fn();
    await expect(translate("Hello", "en", "idu", db, {}, f)).rejects.toThrow(
      "reviewed translation",
    );
    expect(f).not.toHaveBeenCalled();
  });
  it("uses approved Idoma translations and hides pending ones", async () => {
    const data = validate("translation", {
      original: "Public test phrase",
      translated: "Reviewer test translation",
      sourceLanguage: "en",
      targetLanguage: "idu",
    });
    await db
      .prepare("INSERT INTO records VALUES(?,?,?,?,?,?,?)")
      .bind(
        "review-test",
        "translation",
        "member",
        "pending",
        JSON.stringify(data),
        "now",
        "now",
      )
      .run();
    await expect(translate(data.original, "en", "idu", db)).rejects.toThrow(
      "reviewed translation",
    );
    await db.prepare("UPDATE records SET status='approved'").run();
    expect(await translate(data.original, "en", "idu", db)).toMatchObject({
      text: data.translated,
      reviewed: true,
      provider: "Community reviewed",
    });
  });
  it("surfaces provider quota failures", async () => {
    await expect(
      translate("Hello", "en", "ig", db, {}, async () =>
        Response.json({ responseStatus: 429, quotaFinished: true }),
      ),
    ).rejects.toThrow("quota");
  });
  it("splits multibyte input within the provider byte limit", async () => {
    const f = vi.fn(async (_url: any) => answer("ok"));
    await translate("é".repeat(300), "en", "fr", db, {}, f);
    expect(f).toHaveBeenCalledTimes(2);
    for (const [url] of f.mock.calls)
      expect(
        new TextEncoder().encode(new URL(String(url)).searchParams.get("q")!)
          .length,
      ).toBeLessThanOrEqual(450);
  });
  it("blocks cross-origin translation and rate limits public access", async () => {
    const req = () =>
      new Request("http://test/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "Hello", source: "en", target: "en" }),
      });
    expect(
      (
        await handle(
          new Request("http://test/api/translate", {
            method: "POST",
            headers: { origin: "http://evil" },
          }),
          { db, user: null, adminIds: [] },
        )
      ).status,
    ).toBe(403);
    for (let i = 0; i < 12; i++)
      expect(
        (await handle(req(), { db, user: null, adminIds: [] })).status,
      ).toBe(200);
    expect((await handle(req(), { db, user: null, adminIds: [] })).status).toBe(
      429,
    );
  });
});
