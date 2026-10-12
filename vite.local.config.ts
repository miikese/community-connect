import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({plugins:[react()],build:{outDir:".local-build/client",emptyOutDir:true}});
