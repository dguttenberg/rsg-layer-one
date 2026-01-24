import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json(
      { error: "No file received" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    filename: file.name,
    type: file.type,
    size: file.size,
    message: "File received successfully",
  });
}
