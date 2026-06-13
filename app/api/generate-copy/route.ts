import { NextResponse } from "next/server";

type GenerateRequest = {
  currentText?: string;
  tone?: string;
  length?: string;
  userContext?: string;
  recentSteps?: string[];
};

const SYSTEM_PROMPT = `You are a senior copy editor. You rewrite copy according to instructions.

Rules:
- Preserve the core meaning unless asked to change it.
- Do not invent facts, guarantees, metrics, testimonials, or product details.
- Respect required and banned phrases from user context.
- Match the selected tone and length precisely.
- Remove fluff and repetition.
- Improve clarity and rhythm.
- Keep or strengthen CTA language when present.
- Return ONLY valid JSON — no markdown fences, no explanation, no commentary.

Output format (exactly this structure):
{"options":["option 1","option 2","option 3"]}

Each option must be a complete, standalone rewrite of the copy.`;

function extractOptions(content: string, originalText: string): string[] {
  let cleaned = content.trim();

  // Strip <think>...</think> reasoning blocks (Nemotron models)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Try to find JSON object anywhere in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*"options"\s*:\s*\[[\s\S]*\]\s*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const originalNorm = normalize(originalText);

  const isValidOption = (o: unknown): o is string =>
    typeof o === "string" &&
    o.trim().length > 10 &&
    normalize(o) !== originalNorm;

  const tryParse = (text: string): string[] => {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed.options)
        ? parsed.options
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (arr) {
        return arr.filter(isValidOption).map((o: string) => o.trim()).slice(0, 3);
      }
    } catch {}
    return [];
  };

  let result = tryParse(cleaned);
  if (result.length === 3) return result;

  // Try to extract a JSON array directly
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    result = tryParse(arrayMatch[0]);
    if (result.length === 3) return result;
  }

  return [];
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  prompt: string,
  originalText: string
): Promise<{ options: string[]; model: string; usage: unknown } | null> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`Model ${model} failed:`, data?.error?.message);
    return null;
  }

  const outputText = data?.choices?.[0]?.message?.content?.trim();
  if (!outputText) return null;

  const options = extractOptions(outputText, originalText);
  if (options.length < 3) {
    console.error(`Model ${model} returned ${options.length} valid options, raw:`, outputText.slice(0, 300));
    return null;
  }

  return { options, model, usage: data?.usage };
}

export async function POST(request: Request) {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const currentText = body.currentText?.trim();
  const tone = body.tone?.trim();
  const length = body.length?.trim();

  if (!currentText || !tone || !length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured." }, { status: 500 });
  }

  const modelsString = process.env.OPENROUTER_MODELS || "";
  const models = modelsString
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (models.length === 0) {
    models.push("nvidia/nemotron-3-ultra-550b-a55b:free");
  }

  const contextLine = body.userContext ? `\nUser context: ${body.userContext}` : "";
  const stepsLine =
    body.recentSteps && body.recentSteps.length > 0
      ? `\nRecent rewrites: ${body.recentSteps.join(" → ")}`
      : "";

  const prompt = [
    `Rewrite the following copy in a ${tone} tone.`,
    `Target length: ${length}.`,
    contextLine,
    stepsLine,
    "",
    "Copy to rewrite:",
    currentText,
    "",
    'Respond with exactly: {"options":["rewrite 1","rewrite 2","rewrite 3"]}',
  ]
    .filter(Boolean)
    .join("\n");

  // Try each model in sequence until one succeeds
  const errors: string[] = [];
  for (const model of models) {
    try {
      const result = await callOpenRouter(apiKey, model, prompt, currentText);
      if (result) {
        return NextResponse.json({
          outputOptions: result.options,
          usage: { model: result.model, tokens: result.usage },
        });
      }
      errors.push(`${model}: returned invalid format`);
    } catch (e: any) {
      errors.push(`${model}: ${e.message}`);
    }
  }

  return NextResponse.json(
    { error: `All models failed: ${errors.join("; ")}` },
    { status: 502 }
  );
}
