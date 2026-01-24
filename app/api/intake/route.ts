import { NextResponse } from "next/server";
import pdf from "pdf-parse";

const BRAIN_ENDPOINT = process.env.BRAIN_ENDPOINT;

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json(
      { error: "No file received" },
      { status: 400 }
    );
  }

  let text = "";

  if (file.type === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);
    text = data.text;
  } else {
    text = await file.text();
  }

  // --- CALL THE BRAIN ---
  const brainResponse = await fetch(BRAIN_ENDPOINT as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      request_text: text,
    }),
  });

  if (!brainResponse.ok) {
    return NextResponse.json(
      { error: "Brain call failed" },
      { status: 500 }
    );
  }

    const intentObject = await brainResponse.json();

  // --- CALL ORCHESTRATOR ---
  const orchestratorResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/orchestrate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(intentObject),
    }
  );

  const decision = await orchestratorResponse.json();

  return NextResponse.json({
    filename: file.name,
    intentObject,
    decision,
  });
