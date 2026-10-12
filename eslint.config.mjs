import {defineConfig,globalIgnores} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([...nextVitals,...nextTs,globalIgnores(["dist/**","build/**",".local-state/**",".wrangler/**",".sites-runtime/**","node_modules/**"]),{rules:{
 // API payloads are validated at the boundary; SQLite and D1 share a small adapter.
 "@typescript-eslint/no-explicit-any":"off",
 "@typescript-eslint/no-unused-vars":["warn",{"argsIgnorePattern":"^_"}],
 // This frontend also runs as a standalone React application.
 "@next/next/no-html-link-for-pages":"off",
 "@next/next/no-img-element":"off",
 // Effects hydrate device preferences and fetch server state after mount.
 "react-hooks/set-state-in-effect":"off"
}}]);
