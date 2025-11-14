import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                app: "./vnc.html",
            },
        },
    },
    plugins: [viteSingleFile()],
});
