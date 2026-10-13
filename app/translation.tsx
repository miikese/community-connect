"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Languages, ArrowRight, Copy, CheckCircle2 } from "lucide-react";
import { languages, language, label } from "../lib/languages";
import { api } from "../lib/client";
const LanguageContext = createContext({
  code: "en",
  setCode: (_code: string) => {},
  t: (s: string) => s,
});
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("community-language");
      if (saved && language(saved)) setCode(saved);
    } catch {}
  }, []);
  const update = (c: string) => {
    if (!language(c)) return;
    setCode(c);
    try {
      localStorage.setItem("community-language", c);
    } catch {}
  };
  return (
    <LanguageContext.Provider
      value={{ code, setCode: update, t: (s) => label(s, code) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguagePicker() {
  const { code, setCode } = useLanguage();
  return (
    <label className="language-picker">
      <Languages size={16} />
      <select
        aria-label="Preferred language"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function TranslationResult({ text }: { text: string }) {
  const { code, t } = useLanguage();
  const [target, setTarget] = useState(code === "en" ? "ha" : code),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setResult(null);
    setError("");
  }, [text, target]);
  useEffect(() => {
    if (code !== "en") setTarget(code);
  }, [code]);
  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api("translate", "POST", { text, source: "en", target }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="translation-inline">
      <div className="button-row">
        <Languages size={18} />
        <select
          aria-label="Translate listing into"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {languages
            .filter((l) => l.code !== "en")
            .map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
        </select>
        <button
          className="button small secondary"
          disabled={busy}
          onClick={run}
        >
          {busy ? "Translating…" : t("Translate")}
        </button>
      </div>
      <small>
        Translation sends this public text to MyMemory when a reviewed version
        is unavailable. Keep the original for reference.
      </small>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div
          className="translation-output"
          dir={language(target)?.rtl ? "rtl" : "ltr"}
          lang={target}
        >
          <span className="pill">
            {result.reviewed ? <CheckCircle2 size={12} /> : null}
            {result.provider} · {language(target)?.name}
          </span>
          <p>{decode(result.text)}</p>
          {!result.reviewed && (
            <small>
              Automatic translation. A fluent speaker should check important
              details.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
function decode(text: string) {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}
export function Translator() {
  const { code } = useLanguage(),
    [source, setSource] = useState("en"),
    [target, setTarget] = useState(code === "en" ? "ha" : code),
    [text, setText] = useState(""),
    [result, setResult] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [contribute, setContribute] = useState(false);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      setResult(await api("translate", "POST", { text, source, target }));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="section translator-page">
      <p className="eyebrow">Many languages. One community.</p>
      <h1>
        A little closer,
        <br />
        <em>in your own language.</em>
      </h1>
      <p className="muted">
        Read and share across Hausa, Idoma, Igbo and more. Reviewed community
        translations come first; automatic translations are clearly labelled.
      </p>
      <form className="translator-card" onSubmit={run}>
        <div className="field-row">
          <label className="field">
            From
            <select
              aria-label="Source language"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setResult(null);
              }}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            type="button"
            aria-label="Swap languages"
            onClick={() => {
              setSource(target);
              setTarget(source);
              setResult(null);
            }}
          >
            ⇄
          </button>
          <label className="field">
            To
            <select
              aria-label="Target language"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setResult(null);
              }}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Your text
          <textarea
            required
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            maxLength={2000}
            placeholder="Write a public notice, a question, or a message…"
            dir={language(source)?.rtl ? "rtl" : "ltr"}
          />
        </label>
        <small>{new TextEncoder().encode(text).length} / 2,500 bytes</small>
        <label className="translation-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          I agree to send this text to MyMemory if a reviewed translation is
          unavailable. I have removed private information.
        </label>
        <button
          className="button"
          disabled={
            busy ||
            !consent ||
            !text.trim() ||
            new TextEncoder().encode(text).length > 2500
          }
        >
          {busy ? "Translating…" : "Translate text"}
          <ArrowRight size={15} />
        </button>
        {result && (
          <div
            className="translation-output"
            dir={language(target)?.rtl ? "rtl" : "ltr"}
            lang={target}
          >
            <span className="pill">
              {result.provider} ·{" "}
              {result.reviewed
                ? "Reviewed translation"
                : "Automatic translation"}
            </span>
            <p>{decode(result.text)}</p>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                navigator.clipboard
                  .writeText(decode(result.text))
                  .then(() => setMessage("Translation copied."))
                  .catch(() =>
                    setMessage("Select the translated text to copy it."),
                  )
              }
            >
              <Copy size={14} />
              Copy translation
            </button>
          </div>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </form>
      <div className="translation-community">
        <Languages size={28} />
        <div>
          <h2>Help Idoma and Tiv feel at home.</h2>
          <p>
            These languages use reviewed translations from fluent community
            members. Sign in to contribute a public translation. A moderator
            must approve it before others can use it.
          </p>
          <button
            className="button secondary"
            onClick={() => setContribute(!contribute)}
          >
            Contribute a translation
          </button>
        </div>
      </div>
      {contribute && (
        <form
          className="translator-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const fd = new FormData(e.currentTarget);
            try {
              await api("records", "POST", {
                kind: "translation",
                data: {
                  original: text,
                  translated: fd.get("translated"),
                  sourceLanguage: source,
                  targetLanguage: target,
                },
              });
              setMessage(
                "Translation submitted for language review. It stays private until approved.",
              );
              setContribute(false);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            <strong>
              {language(source)?.name} → {language(target)?.name}
            </strong>
          </p>
          <p className="muted">
            Original: {text || "Enter the original text above first."}
          </p>
          <label className="field">
            Your translation
            <textarea
              name="translated"
              minLength={1}
              maxLength={2000}
              required
            />
          </label>
          <button
            className="button"
            disabled={busy || !text.trim() || source === target}
          >
            Submit for review
          </button>
        </form>
      )}
      <p className="muted">
        Hausa and Igbo navigation labels are available through the language
        menu. Other interface text currently remains in English. Idoma and Tiv
        automatic translation is not claimed.
      </p>
    </section>
  );
}
