"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f2ea", color: "#24201a", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 16 }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#6b6355" }}>The app couldn&rsquo;t start. Please try again in a moment.</p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, background: "#2c5a4b", color: "#f8f5ee", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
