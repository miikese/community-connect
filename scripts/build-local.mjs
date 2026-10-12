import {build} from "vite";
import {build as bundle} from "esbuild";
await build({configFile:"vite.local.config.ts"});
await bundle({entryPoints:["lib/local-entry.ts"],bundle:true,platform:"node",format:"esm",outfile:".local-build/service.mjs"});
