"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="min-h-dvh bg-grain">
      <ErrorFallback error={error} retry={retry} />
    </main>
  );
}
