import { NextResponse } from "next/server";
import pdf from "pdf-parse";

const BRAIN_ENDPOINT = process.env.BRAIN_ENDPOINT;
const PROCESSOR_ENDPOINT = process.env.PROCESSOR_ENDPOINT;

type ProcessedResult = {
  filename: string;
  success: boolean;
  intentObject?: any;
  processed?: any
  error?: string;
};

async function extractText(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);
    return data.text;
  }
  return await file.text();
}

async function processSingleBrief(file: File): Promise<ProcessedResult> {
  const filename = file.name;

  try {
    // Extract text from file
    const text = await extractText(file);

    // Call the Brain
    const brainResponse = await fetch(BRAIN_ENDPOINT as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_text: text }),
    });

    if (!brainResponse.ok) {
      const errorText = await brainResponse.text();
      return {
        filename,
        success: false,
        error: `Brain call failed: ${errorText}`,
      };
    }

    const intentObject = await brainResponse.json();

    // Call the Processor
    const processorResponse = await fetch(PROCESSOR_ENDPOINT as string, {
      method: "POST",
      headers: {"Content-Type": "application/json" },
      body: JSON.stringify({ intent_object: intentObject }),
    });

    if (!processorResponse.ok) {
      const errorText = await processorResponse.text();
      return {
        filename,
        success: false,
        intentObject,
        error: `Processor call failed: ${errorText}`,
      };
    }

    const processed = await processorResponse.json();

    return {
      filename,
      success: true,
      intentObject,
      processed,
    };
  } catch (err: any) {
    return {
      filename,
      success: false,
      error: err.message || "Unknown error",
    };
  }
}

export async function POST(req: Request) {
  const formData = await req.formData();

  // Get all files - supports both single "file" and multiple "files"
  const files: File[] = [];

  // Check for single file upload (backward compatible)
  const singleFile = formData.get("file") as File | null;
  if (singleFile) {
    files.push(singleFile);
  }

  // Check for multiple files upload
  const multipleFiles = formData.getAll("files") as File[];
  files.push(...multipleFiles.filter(f => f instanceof File));

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files received" },
      { status: 400 }
    );
  }

  // Process all briefs in parallel
  const results = await Promise.all(
    files.map(file => processSingleBrief(file))
  );

  // Summary stats
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return NextResponse.json({
    summary: {
      total: files.length,
      successful,
      failed,
    },
    results,
  });
}
