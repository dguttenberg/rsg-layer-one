"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  async function handleSubmit() {
    if (!file) return;

    setStatus("Uploading...");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/intake", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    setStatus(JSON.stringify(result, null, 2));
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>RSG Layer 1 Intake</h1>

      <input
        type="file"
        accept=".pdf,.txt"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <br /><br />

      <button onClick={handleSubmit}>Submit</button>

      <pre style={{ marginTop: 20 }}>{status}</pre>
    </main>
  );
}
