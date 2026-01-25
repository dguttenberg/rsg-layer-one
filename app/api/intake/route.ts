import { NextResponse } from "next/server";
import pdf from "pdf-parse";

const BRAIN_ENDPOINT = process.env.BRAIN_ENDPOINT;
const PROCESSOR_ENDPOINT = process.env.PROCESSOR_ENDPOINT;

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

  // --- STEP 1: CALL THE BRAIN ---
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
    const errorText = await brainResponse.text();
    return NextResponse.json(
      { error: "Brain call failed", details: errorText },
      { status: 500 }
    );
  }

  const intentObject = await brainResponse.json();

  // --- STEP 2: CALL THE PROCESSOR (nextjs-boilerplate) ---
  const processorResponse = await fetch(PROCESSOR_ENDPOINT as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ intentObject }),
  });

  if (!processorResponse.ok) {
    const errorText = await processorResponse.text();
    return NextResponse.json(
      {
        error: "Processor call failed",
        details: errorText,
        intentObject, // Still return brain output
      },
      { status: 500 }
    );
  }

  const processed = await processorResponse.json();

  // --- RETURN COMBINED OUTPUT ---
  return NextResponse.json({
    filename: file.name,
    intentObject,
    processed,
  });
}
