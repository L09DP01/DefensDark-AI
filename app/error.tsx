"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global App Error:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-destructive">Something went wrong!</h2>
        <div className="rounded-md bg-muted p-4 text-left text-sm overflow-auto max-h-[300px]">
          <p className="font-semibold text-red-500">{error.name}: {error.message}</p>
          <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{error.stack}</pre>
        </div>
        <button
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
