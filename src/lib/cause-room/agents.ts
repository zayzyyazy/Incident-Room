import { z } from "zod";
import {
  AgentChallengeNormalizeContext,
  CauseFindingContext,
  CausalJudgeBridgeContext,
  injectCauseRoomEnvelope,
  normalizeAgentChallenge,
  normalizeCauseFinding,
  normalizeCausalJudgeBridge,
  normalizeCausalJudgeTask,
} from "@/lib/cause-room/llm-normalize";
import { AGENT_MODELS, completeJson } from "@/lib/llm/router";
import {
  AgentChallengeSchema,
  BackendWitnessInitialSchema,
  CausalJudgeBridgeSchema,
  CausalJudgeTaskSchema,
  CauseFindingSchema,
  ClaimTracerInitialSchema,
} from "@/lib/cause-room/types";
import {
  BACKEND_WITNESS_CHALLENGE_PROMPT,
  BACKEND_WITNESS_SYSTEM_PROMPT,
  CAUSAL_JUDGE_BRIDGE_PROMPT,
  CAUSAL_JUDGE_FINDING_PROMPT,
  CAUSAL_JUDGE_TASK_PROMPT,
  CLAIM_TRACER_CHALLENGE_PROMPT,
  CLAIM_TRACER_SYSTEM_PROMPT,
} from "@/lib/cause-room/prompts";

type CauseRoomEnvelope = {
  type: string;
  agent_role?: string;
};

async function runWithFallback<T extends z.ZodType>(
  schema: T,
  systemPrompt: string,
  userContent: unknown,
  modelKey: keyof typeof AGENT_MODELS,
  envelope?: CauseRoomEnvelope,
  postNormalize?: (parsed: unknown) => unknown,
): Promise<z.infer<T>> {
  const primary = AGENT_MODELS[modelKey];
  const payload = JSON.stringify(userContent, null, 2);

  async function attempt(
    provider: (typeof AGENT_MODELS)[typeof modelKey]["provider"],
    model: string,
    extraUserNote?: string,
  ) {
    return completeJson(schema, {
      provider,
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: extraUserNote
            ? `${payload}\n\n${extraUserNote}`
            : payload,
        },
      ],
      transformParsed: (parsed) => {
        let next = envelope ? injectCauseRoomEnvelope(parsed, envelope) : parsed;
        if (postNormalize) {
          next = postNormalize(next);
        }
        return next;
      },
    });
  }

  try {
    return await attempt(primary.provider, primary.model);
  } catch (primaryError) {
    const fallback = primary.fallback;
    const errText =
      primaryError instanceof Error ? primaryError.message : String(primaryError);
    // #region agent log
    fetch("http://127.0.0.1:7414/ingest/8c489388-e9c2-47c1-ab4e-bc98ccacfe33", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "aca1d4",
      },
      body: JSON.stringify({
        sessionId: "aca1d4",
        hypothesisId: "A-B",
        location: "cause-room/agents.ts:runWithFallback",
        message: "LLM schema validation failed",
        data: {
          modelKey,
          envelopeType: envelope?.type,
          errSnippet: errText.slice(0, 500),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const validationHint =
      errText.includes("Invalid input") ||
      errText.includes("invalid_type") ||
      errText.includes("did not return JSON")
        ? "Return ONLY valid JSON for agent_challenge: round (number), stance (CHALLENGE|SUPPORT|YIELD), prior_hypothesis_class, updated_hypothesis_class, prior_hypothesis_en, updated_hypothesis_en, target_band_message_id, target_post_type, evidence_cited[{detail_en}], explanation_en, opinion_changed (boolean)."
        : undefined;

    try {
      return await attempt(
        fallback.provider,
        fallback.model,
        validationHint,
      );
    } catch (fallbackError) {
      if (validationHint) {
        try {
          return await attempt(primary.provider, primary.model, validationHint);
        } catch {
          throw fallbackError;
        }
      }
      throw primaryError;
    }
  }
}

export async function runClaimTracerInitial(context: unknown) {
  return runWithFallback(
    ClaimTracerInitialSchema,
    CLAIM_TRACER_SYSTEM_PROMPT,
    context,
    "claimTracer",
    { type: "claim_tracer_initial", agent_role: "claim_tracer" },
  );
}

export async function runBackendWitnessInitial(context: unknown) {
  return runWithFallback(
    BackendWitnessInitialSchema,
    BACKEND_WITNESS_SYSTEM_PROMPT,
    context,
    "backendWitness",
    { type: "backend_witness_initial", agent_role: "backend_witness" },
  );
}

export async function runCausalJudgeTask(context: unknown) {
  return runWithFallback(
    CausalJudgeTaskSchema,
    CAUSAL_JUDGE_TASK_PROMPT,
    context,
    "causalJudge",
    { type: "causal_judge_task", agent_role: "causal_judge" },
    (parsed) => normalizeCausalJudgeTask(parsed),
  );
}

export async function runCausalJudgeBridge(context: unknown) {
  const ctx = context as CausalJudgeBridgeContext;
  return runWithFallback(
    CausalJudgeBridgeSchema,
    CAUSAL_JUDGE_BRIDGE_PROMPT,
    context,
    "causalJudge",
    { type: "causal_judge_bridge", agent_role: "causal_judge" },
    (parsed) => normalizeCausalJudgeBridge(parsed, ctx),
  );
}

export async function runClaimTracerChallenge(context: unknown) {
  const ctx = context as AgentChallengeNormalizeContext;
  return runWithFallback(
    AgentChallengeSchema,
    CLAIM_TRACER_CHALLENGE_PROMPT,
    context,
    "claimTracer",
    { type: "agent_challenge", agent_role: "claim_tracer" },
    (parsed) => normalizeAgentChallenge(parsed, ctx, "claim_tracer"),
  );
}

export async function runBackendWitnessChallenge(context: unknown) {
  const ctx = context as AgentChallengeNormalizeContext;
  return runWithFallback(
    AgentChallengeSchema,
    BACKEND_WITNESS_CHALLENGE_PROMPT,
    context,
    "backendWitness",
    { type: "agent_challenge", agent_role: "backend_witness" },
    (parsed) => normalizeAgentChallenge(parsed, ctx, "backend_witness"),
  );
}

export async function runCauseFinding(context: unknown) {
  const ctx = context as CauseFindingContext;
  return runWithFallback(
    CauseFindingSchema,
    CAUSAL_JUDGE_FINDING_PROMPT,
    context,
    "causalJudge",
    { type: "cause_finding" },
    (parsed) => normalizeCauseFinding(parsed, ctx),
  );
}
