import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      // Same unit tests with the host clock at both extremes (UTC+14 and
      // UTC-11), proving the app never leans on the machine's timezone.
      ...["Pacific/Kiritimati", "Pacific/Pago_Pago"].map((tz) => ({
        extends: true as const,
        test: { name: `unit-${tz.split("/")[1]}`, include: ["src/**/*.test.ts"], environment: "node" as const, env: { TZ: tz } },
      })),
      {
        // Runs against the local Supabase stack (`npm run db:start`).
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
