import { NextResponse } from "next/server";
// Import core parser directly — avoids test-file loading + deprecated Buffer() on Node 22+
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js');

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

// Map Brain v2 routing + project_type to a Workfront workflow scope
// Uses both signals: routing.recommendation tells us creative vs production,
// project_type.primary tells us the nature of the work (pickup vs net new vs outdated)
function determineWorkflowScope(routing: any, projectType: any): string {
  const recommendation = (routing.recommendation || "").toLowerCase();
  const primary = (typeof projectType === "string"
    ? projectType
    : projectType?.primary || ""
  ).toLowerCase();

  // Creative Concepting: needs an idea — output of round one is a deck
  if (
    primary === "net_new_creative" ||
    primary === "logo_identity" ||
    recommendation === "concepting"
  ) {
    return "concepting";
  }

  // Creative Adaptation: design/creative thinking needed but concept exists
  // pickup_outdated_brand always goes here regardless of routing recommendation
  if (
    primary === "pickup_outdated_brand" ||
    primary === "two_stage" ||
    recommendation === "two_stage" ||
    (recommendation === "creative" && primary !== "net_new_creative" && primary !== "logo_identity")
  ) {
    return "adaptation";
  }

  // Quick Turn: templated execution, straight to studio
  return "quick_turn";
}

// Adapt Brain v2 flat schema to the v1 nested schema expected by the processor
function adaptBrainV2ToProcessorFormat(v2Output: any): any {
  const deliverables = (v2Output.deliverables || []).map((d: any) => ({
    deliverable_name: String(d.type || d.name || d.deliverable_name || "Unknown"),
    format_hint: d.format || d.format_hint || "",
    qty: d.quantity || d.qty || 1,
  }));

  const clarifications = v2Output.clarifications_needed || [];
  const routing = v2Output.routing || {};
  const confidence = routing.confidence || v2Output._metadata?.confidence || 0.85;

  return {
    intent_object: {
      meta: {
        schema_version: "1.0-adapted-from-v2",
        brain_version: "2.0",
        generated_at: new Date().toISOString(),
        run_id: v2Output._metadata?.run_id || `v2-${Date.now()}`,
      },
      input: {
        request_text: v2Output.request_summary || "",
        property: typeof v2Output.property === 'string' ? v2Output.property : (v2Output.property?.id || v2Output.property?.name || "unknown"),
        channel_hint: (v2Output.channels || [])[0] || "",
        due_date: v2Output.timeline?.due_date || "",
        attachments: [],
      },
      intent: {
        why: {
          stated: v2Output.request_summary || "",
          inferred: v2Output.content?.campaign_purpose || v2Output.request_summary || "",
          confidence,
        },
        who: {
          segments: v2Output.content?.audience || [],
          posture: "promotional",
          confidence: 0.8,
        },
        what: {
          scope_class: determineWorkflowScope(routing, v2Output.project_type),
          novelty: String(v2Output.project_type ?? "").includes("net_new")
            ? "net_new"
            : String(v2Output.project_type ?? "").includes("pickup")
            ? "pickup"
            : "derivative",
          deliverables,
          confidence,
        },
        where: {
          channels: v2Output.channels || [],
          constraints: [],
          confidence: 0.85,
        },
        how_hard: {
          speed_sensitivity: v2Output.timeline?.urgency || "medium",
          rework_risk: routing.recommendation === "creative" ? "high" : "low",
          coordination_cost: (routing.flags || []).includes("multi_property") ? "high" : "low",
          confidence: 0.8,
        },
        overall_confidence: confidence,
      },
      uncertainty: {
        assumptions: [],
        missing_info: [],
        flags: routing.flags || [],
        human_confirmation_required: clarifications.length > 0,
        questions_for_humans: clarifications.map((c: any) => typeof c === 'string' ? c : (c.item || c.question || JSON.stringify(c))),
      },
      sources: {
        source_refs_used: [],
        citations: [],
      },
    },
    is_valid: true,
    validation_errors: [],
    model_used: v2Output._metadata?.model || "claude-sonnet",
    processing_time_ms: 0,
    summary_markdown: v2Output.request_summary || "",
  };
}

async function processSingleBrief(file: File): Promise<ProcessedResult> {
  const filename = file.name;
  let intentObject: any = null;
  try {
    const text = await extractText(file);
    const brainResponse = await fetch(BRAIN_ENDPOINT as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_text: text }),
    });
    if (!brainResponse.ok) {
      const errorText = await brainResponse.text();
      return { filename, success: false, error: `Brain call failed: ${errorText}` };
    }
    intentObject = await brainResponse.json();
    const processorPayload = adaptBrainV2ToProcessorFormat(intentObject);
    const processorResponse = await fetch(PROCESSOR_ENDPOINT as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(processorPayload),
    });
    if (!processorResponse.ok) {
      const errorText = await processorResponse.text();
      return { filename, success: false, intentObject, error: `Processor call failed: ${errorText}` };
    }
    const processed = await processorResponse.json();
    return { filename, success: true, intentObject, processed };
  } catch (err: any) {
    return { filename, success: false, intentObject, error: err.message || "Unknown error" };
  }
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const files: File[] = [];
  const singleFile = formData.get("file") as File | null;
  if (singleFile) files.push(singleFile);
  const multipleFiles = formData.getAll("files") as File[];
  files.push(...multipleFiles.filter(f => f instanceof File));
  if (files.length === 0) {
    return NextResponse.json({ error: "No files received" }, { status: 400 });
  }
  const results = await Promise.all(files.map(file => processSingleBrief(file)));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  return NextResponse.json({ summary: { total: files.length, successful, failed }, results });
}
