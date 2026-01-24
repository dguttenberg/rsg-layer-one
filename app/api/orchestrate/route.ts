import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const intentObject = await req.json();

  // --- HARD STOPS ---
  if (intentObject?.uncertainty?.human_confirmation_required) {
    return NextResponse.json({
      status: "blocked",
      reason: "Human confirmation required",
      questions: intentObject.uncertainty.questions_for_humans
    });
  }

  // --- ROUTING LOGIC ---
  let route = "unknown";

  const scopeClass = intentObject?.intent?.what?.scope_class;
  const speed = intentObject?.intent?.how_hard?.speed_sensitivity;

  if (scopeClass === "production") {
    route = "studio_direct";
  } else if (scopeClass === "concept") {
    route = "creative_review";
  }

  // --- ESCALATION ---
  const escalation = speed === "high";

  return NextResponse.json({
    status: "routed",
    route,
    escalation
  });
}
