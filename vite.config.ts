import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue2 from "@vitejs/plugin-vue2";

export default defineConfig(({ mode }) => {    
    const envVars = loadEnv(mode, process.cwd(), "");
    return {        
        plugins: [
            vue2(),
            {
                // Control if we are set to test mode when building the website (for production).
                // Note that a hook on git pre-push is also in place for the same purpose, but that 
                // is a local setting which is not saved in Git remotely.
                name: "check-global-variable",
                enforce: "pre",
                buildStart() {
                    if (mode == "production" && envVars.VITE_IS_LOCAL_STANDALONE_TEST_VERSION == "true") {
                        throw new Error("❌ Build blocked: your are building a TEST version (VITE_IS_LOCAL_STANDALONE_TEST_VERSION is not set to false)");
                    }
                },
            },
        ],
        base: "/localisation-tool/",
        resolve: {
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
            },
        },
    };
});