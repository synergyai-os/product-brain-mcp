import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SHEBANG = "#!/usr/bin/env node\n";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: false,
  define: {
    __SYNERGYOS_POSTHOG_KEY__: JSON.stringify(process.env.SYNERGYOS_POSTHOG_KEY ?? ""),
  },
  onSuccess: async () => {
    for (const file of ["dist/index.js", "dist/cli/index.js"]) {
      const path = join(process.cwd(), file);
      const content = readFileSync(path, "utf-8");
      if (!content.startsWith("#!")) {
        writeFileSync(path, SHEBANG + content);
      }
    }
  },
});
