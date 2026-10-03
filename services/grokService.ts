export type GrokPlanInput = {
  crop: string;
  cropStage: string;
  soil: {
    soilType: string;
    drainage: string;
    fieldCapacity: number;
    moistureBaseline: number;
    soilTemperature: number | null;
    source: string;
  };
  soilMoisture: number | null;
  moistureSource: string;
  sevenDayWeather: {
    day: string;
    temperatureMax: number;
    humidity: number;
    rainProbability: number;
    rainfallMm: number;
    windSpeed: number;
  }[];
  irrigationDecisions: { day: string; motor: "ON" | "OFF"; reason: string }[];
  sprayDecisions: { day: string; advice: string; reason: string }[];
};

export type GrokExplanation = {
  summary: string;
  daily: string[];
};

function readEnv(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  const value = env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The key is read from the environment. It is never written into source.
 * Expo only exposes EXPO_PUBLIC_* to the app, so a production build should
 * call Grok from a server instead of shipping the key in the client.
 */
export function grokApiKey(): string | undefined {
  return readEnv("EXPO_PUBLIC_GROK_API_KEY") ?? readEnv("GROK_API_KEY");
}

export function isGrokConfigured(): boolean {
  return Boolean(grokApiKey());
}

function parseExplanation(content: string, dayCount: number): GrokExplanation | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as {
      summary?: unknown;
      daily?: unknown;
    };
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) {
      return null;
    }
    if (!Array.isArray(parsed.daily) || parsed.daily.length !== dayCount) {
      return null;
    }
    const daily = parsed.daily.map((line) => (typeof line === "string" ? line.trim() : ""));
    if (daily.some((line) => line.length === 0)) {
      return null;
    }
    return { summary: parsed.summary.trim(), daily };
  } catch {
    return null;
  }
}

/**
 * Rewrites an already-decided plan into short sentences.
 * Returns null when the key is missing or the call fails. Decisions stay in the app.
 */
export async function explainPlan(input: GrokPlanInput): Promise<GrokExplanation | null> {
  const key = grokApiKey();
  if (!key) {
    return null;
  }

  const model = readEnv("EXPO_PUBLIC_GROK_MODEL") ?? "grok-3";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You explain a farm plan that is already decided. Use very simple words and short sentences. Do not change motor ON/OFF, spray yes/no, or the weather numbers. Reply with JSON only: {\"summary\":\"one or two sentences\",\"daily\":[\"one sentence per day\"]}. daily must have one string per input day, in the same order.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }
    return parseExplanation(content, input.sevenDayWeather.length);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
