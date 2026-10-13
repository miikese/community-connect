import { language } from "./languages";
import type { DB } from "./service";
export type TranslationOptions = { apiKey?: string; endpoint?: string };
export async function translate(
  text: unknown,
  source: unknown,
  target: unknown,
  db: DB,
  options: TranslationOptions = {},
  fetcher: typeof fetch = fetch,
) {
  if (
    typeof text !== "string" ||
    !text.trim() ||
    new TextEncoder().encode(text).length > 2500
  )
    throw new Error("Enter between 1 and 2,500 bytes of text.");
  if (
    typeof source !== "string" ||
    typeof target !== "string" ||
    !language(source) ||
    !language(target)
  )
    throw new Error("Choose supported languages.");
  const input = text.trim();
  if (source === target)
    return {
      text: input,
      source,
      target,
      provider: "Original",
      reviewed: true,
    };
  const saved = await db
    .prepare(
      "SELECT data FROM records WHERE kind='translation' AND status='approved' AND json_extract(data,'$.original')=? AND json_extract(data,'$.sourceLanguage')=? AND json_extract(data,'$.targetLanguage')=? ORDER BY updated DESC LIMIT 1",
    )
    .bind(input, source, target)
    .first();
  if (saved)
    return {
      text: JSON.parse(saved.data).translated,
      source,
      target,
      provider: "Community reviewed",
      reviewed: true,
    };
  if (language(source)?.reviewedOnly || language(target)?.reviewedOnly)
    throw Object.assign(
      new Error(
        "A reviewed translation is not available yet. Contribute a translation below for a language reviewer to check.",
      ),
      { status: 422 },
    );
  const chunks: string[] = [];
  let chunk = "";
  for (const char of input) {
    if (new TextEncoder().encode(chunk + char).length > 450) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  const outputs: string[] = [];
  for (const q of chunks) {
    const url = new URL(
      options.endpoint || "https://api.mymemory.translated.net/get",
    );
    url.searchParams.set("q", q);
    url.searchParams.set("langpair", source + "|" + target);
    if (options.apiKey) url.searchParams.set("key", options.apiKey);
    let response: Response;
    try {
      response = await fetcher(url, { signal: AbortSignal.timeout(12000) });
    } catch {
      throw Object.assign(
        new Error(
          "Translation service is unavailable. Your original text is still available.",
        ),
        { status: 503 },
      );
    }
    const d = (await response.json()) as any;
    if (
      !response.ok ||
      Number(d.responseStatus) !== 200 ||
      d.quotaFinished ||
      typeof d.responseData?.translatedText !== "string"
    )
      throw Object.assign(
        new Error(
          "Translation is unavailable for this language pair or the provider's daily quota is exhausted. Try again later or contribute a reviewed translation.",
        ),
        { status: 503 },
      );
    outputs.push(d.responseData.translatedText);
  }
  return {
    text: outputs.join(""),
    source,
    target,
    provider: "MyMemory",
    reviewed: false,
  };
}
