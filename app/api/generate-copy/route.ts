import { NextResponse } from "next/server";

type GenerateRequest = {
  currentText?: string;
  tone?: string;
  length?: string;
  userContext?: string;
  recentSteps?: string[];
};

const hygieneChecklist = [
  "Preserve the core meaning unless the user explicitly asks to change it.",
  "Do not invent facts, guarantees, metrics, testimonials, or product details.",
  "Respect required and banned phrases from user context.",
  "Match the selected tone and length.",
  "Remove fluff and repetition.",
  "Improve clarity and rhythm.",
  "Keep or strengthen CTA language when present.",
  "Return only the requested JSON object.",
];

function extractOptions(content: string): string[] {
  const cleaned = content
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { options?: unknown };
    if (Array.isArray(parsed.options)) {
      return parsed.options
        .filter((option): option is string => typeof option === "string")
        .map((option) => option.trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    return cleaned
      .split(/\n+(?=\d+[.)]\s|- )/)
      .map((line) => line.replace(/^\s*(?:\d+[.)]|-)\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  return [];
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

  const keysString = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || "";
  const keys = keysString.split(",").map(k => k.trim()).filter(Boolean);
  const modelsString = process.env.OPENROUTER_MODELS || "";
  const models = modelsString.split(",").map(m => m.trim()).filter(Boolean);

  const hfModel = models.find(m => m.startsWith("hf-space:"));
  const openRouterModels = models.filter(m => !m.startsWith("hf-space:"));

  const apiKey = keys[Math.floor(Math.random() * keys.length)];
  const fallbackModel = openRouterModels[Math.floor(Math.random() * openRouterModels.length)] || "google/gemma-3n-e4b-it:free";

  const prompt = [
    "You are a senior copy editor.",
    "Return exactly three options in JSON.",
    '{"options":["option 1","option 2","option 3"]}',
    "",
    `Tone: ${tone}`,
    `Length: ${length}`,
    `Context: ${body.userContext || "None"}`,
    "Copy:",
    currentText,
  ].join("\n");

  // 1. Try HF-First
  if (hfModel) {
    try {
      const spaceId = hfModel.replace("hf-space:", "");
      const baseUrl = `https://${spaceId.replace("/", "-")}.hf.space/gradio_api`;
      
      const initiateRes = await fetch(`${baseUrl}/call/v2/predict`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_TOKEN}`
        },
        body: JSON.stringify({
          data: [currentText, tone, length, body.userContext || "", (body.recentSteps || []).join(" | ")]
        })
      });

      if (initiateRes.ok) {
        const { event_id } = await initiateRes.json();
        let outputText = "";
        const pollUrl = `${baseUrl}/call/predict/${event_id}`;
        
        for (let i = 0; i < 40; i++) { // 20s max
          const pollRes = await fetch(pollUrl, {
            headers: { "Authorization": `Bearer ${process.env.HF_TOKEN}` }
          });
          const chunk = await pollRes.text();
          if (chunk.includes("event: complete")) {
            const dataMatch = chunk.match(/data:\s*\["(.*)"\]/);
            if (dataMatch) {
              outputText = dataMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
              break;
            }
          }
          await new Promise(r => setTimeout(r, 500));
        }

        if (outputText) {
          const outputOptions = extractOptions(outputText);
          if (outputOptions.length === 3) {
            return NextResponse.json({
              outputOptions,
              usage: { model: hfModel, tokens: "HF-Space" },
            });
          }
        }
      }
    } catch (e) {
      console.error("HF-First failed, falling back:", e);
    }
  }

  // 2. Fallback to OpenRouter Roulette
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: fallbackModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "OpenRouter failed");

    const outputText = data?.choices?.[0]?.message?.content?.trim();
    const outputOptions = outputText ? extractOptions(outputText) : [];

    if (outputOptions.length !== 3) throw new Error("Invalid response format");

    return NextResponse.json({
      outputOptions,
      usage: { model: fallbackModel, tokens: data?.usage },
    });
  } catch (error: any) {
    console.error("Final Fallback Error:", error);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
