import { BandAgentProfile } from "@/lib/band/client";

const BAND_AGENT_KEY_RE = /^band_a_/i;

function isBandAgentApiKey(apiKey: string): boolean {
  return BAND_AGENT_KEY_RE.test(apiKey.trim());
}

async function fetchAgentProfile(apiKey: string): Promise<BandAgentProfile | null> {
  if (!isBandAgentApiKey(apiKey)) {
    return null;
  }

  const baseUrl = process.env.BAND_REST_URL ?? "https://app.band.ai/api/v1";
  const response = await fetch(`${baseUrl}/agent/me`, {
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    console.warn(
      "Band internal agent key rejected:",
      JSON.stringify(body?.error ?? body),
    );
    return null;
  }
  const agent =
    body?.data?.agent ?? body?.agent ?? body?.data ?? body;
  if (!agent?.id) {
    return null;
  }
  return agent as BandAgentProfile;
}

export type InternalBandAgent = {
  apiKey: string;
  profile: BandAgentProfile;
  displayName: string;
  handle: string;
};

export type InternalBandAgents = {
  normalizer?: InternalBandAgent;
  verdictJudge?: InternalBandAgent;
  roomHost?: InternalBandAgent;
};

/** Band internal agents already sitting in the demo room (Normaliezer, Verdictjudge). */
export async function resolveInternalBandAgents(): Promise<InternalBandAgents> {
  const normalizerKey = process.env.BAND_API_KEY_NORMALIZER?.trim();
  const verdictKey = process.env.BAND_API_KEY_VERDICT_JUDGE?.trim();
  const hostKey = process.env.BAND_API_KEY?.trim();

  const out: InternalBandAgents = {};

  if (normalizerKey) {
    const profile = await fetchAgentProfile(normalizerKey);
    if (profile) {
      out.normalizer = {
        apiKey: normalizerKey,
        profile,
        displayName: profile.name ?? "Normalizer",
        handle:
          process.env.BAND_INTERNAL_NORMALIZER_HANDLE?.trim() ??
          profile.handle ??
          "normaliezer",
      };
    }
  }

  if (verdictKey) {
    const profile = await fetchAgentProfile(verdictKey);
    if (profile) {
      out.verdictJudge = {
        apiKey: verdictKey,
        profile,
        displayName: profile.name ?? "Verdict Judge",
        handle:
          process.env.BAND_INTERNAL_VERDICT_JUDGE_HANDLE?.trim() ??
          profile.handle ??
          "verdictjudge",
      };
    }
  }

  if (hostKey) {
    const profile = await fetchAgentProfile(hostKey);
    if (profile) {
      out.roomHost = {
        apiKey: hostKey,
        profile,
        displayName: profile.name ?? "Incident Room",
        handle: profile.handle ?? "incident-room",
      };
    }
  }

  return out;
}
