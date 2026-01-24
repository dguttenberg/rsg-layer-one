import { NextResponse } from "next/server";
import pdf from "pdf-parse";

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

  return NextResponse.json({
    filename: file.name,
    type: file.type,
    extractedTextPreview: text.slice(0, 1000),
    charCount: text.length
  });
}
