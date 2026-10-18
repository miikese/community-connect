"use client";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { api } from "../lib/client";
import { Notice } from "./components";
export function AccountPage() {
  const [mode, setMode] = useState<"login" | "register">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="section account-page">
      <p className="eyebrow">Your people. Your place.</p>
      <h1>
        One account.
        <br />
        <em>A community of possibilities.</em>
      </h1>
      <p className="muted">
        Register as a person, then create a named school, street or community
        workspace. Your account can help administer more than one workspace.
      </p>
      <div className="account-layout">
        <form
          className="card account-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const fd = new FormData(e.currentTarget);
            try {
              const result=await api("auth/" + mode, "POST", Object.fromEntries(fd));
              location.assign(
                new URL(result.user?.role==="super-admin"?"/?section=platform":"/?section=communities", location.origin).href,
              );
            } catch (e) {
              setMessage((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <div className="workspace-tabs">
            <button
              type="button"
              aria-pressed={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
            >
              Create account
            </button>
          </div>
          <h2>
            {mode === "login" ? "Welcome back." : "Start with your name."}
          </h2>
          {mode === "register" && (
            <label className="field">
              Display name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </label>
          )}
          <label className="field">
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          {message && <Notice error>{message}</Notice>}
          <button className="button" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in to your account"
                : "Create my account"}
            <ArrowRight size={15} />
          </button>
          <p className="muted account-help">
            Platform administrators use the same sign-in form. Administrative
            roles are assigned securely on the server.
          </p>
        </form>
        <aside className="account-benefits">
          <Users size={32} />
          <h2>
            A place for every school.
            <br />A voice for every street.
          </h2>
          <p>
            Give your school or community a named workspace, share useful
            updates, and keep them connected to the wider platform.
          </p>
          <div>
            <ShieldCheck size={20} />
            <p>
              Up to 10 workspace admins can publish updates. Their access stays
              within the workspaces they administer.
            </p>
          </div>
          <small>
            Email addresses and passwords are kept out of public feeds.
            Workspace registration requires platform review.
          </small>
        </aside>
      </div>
    </section>
  );
}
