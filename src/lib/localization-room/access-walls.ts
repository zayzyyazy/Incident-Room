import { LeapingAgentSlice } from "@/lib/localization-room/load-artifact";
import { BandPostContext } from "@/lib/cause-room/types";
import { SurfaceCandidate } from "@/lib/localization-room/types";
import { CauseFindingArtifact } from "@/lib/cross-room/artifacts";

const KLAUS_PATH_STAGE_IDS = new Set([
  "069318de-90ba-7575-8000-da119d5c5106",
  "fd967f98-2f26-49b0-9713-aeafe6670493",
  "27411b25-0e4a-4fbe-933e-70ebdc7afc0f",
  "c6754cc3-030f-4f1b-96c2-b3797a00d10b",
  "23075e2c-a16f-403a-8bbd-0356a093902d",
  "6e34730e-43f5-49ac-8e4b-571f1a6ce3f8",
]);

function stageGraphView(artifact: LeapingAgentSlice) {
  return {
    platform: "leaping",
    access_boundary:
      "Workflow graph only — stages, transitions, switch defaults, field setters. No prompts or tool schemas.",
    stages: artifact.stages
      .filter((s) => KLAUS_PATH_STAGE_IDS.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        field_name: s.field_name,
        value: s.value,
        transitions: (s.transitions ?? []).map((t) => ({
          name: t.name,
          to: t.to,
          description: t.description,
        })),
      })),
  };
}

function policyView(artifact: LeapingAgentSlice) {
  return {
    platform: "leaping",
    access_boundary:
      "Prompts and policies only — system message excerpt and stage_message for path stages. No full graph.",
    system_message_excerpt:
      artifact.system_message_excerpt ??
      artifact.system_message?.slice(0, 1200),
    stage_policies: artifact.stages
      .filter(
        (s) =>
          KLAUS_PATH_STAGE_IDS.has(s.id) &&
          (s.stage_message || s.type === "response"),
      )
      .map((s) => ({
        stage_id: s.id,
        stage_name: s.name,
        stage_message: s.stage_message ?? "(intent routing stage)",
      })),
  };
}

function guardView(artifact: LeapingAgentSlice, runtimeToolAliases: Record<string, string>) {
  const pathFunctions = new Set<string>();
  for (const stage of artifact.stages) {
    if (!KLAUS_PATH_STAGE_IDS.has(stage.id)) continue;
    for (const fn of stage.functions ?? []) {
      pathFunctions.add(fn);
    }
  }
  for (const aliased of Object.values(runtimeToolAliases)) {
    pathFunctions.add(aliased);
  }

  return {
    platform: "leaping",
    access_boundary:
      "Tool contracts only — function defs on path + runtime aliases. No transcript or full workflow.",
    runtime_tool_aliases: runtimeToolAliases,
    functions: artifact.functions
      .filter((f) => pathFunctions.has(f.name))
      .map((f) => ({
        name: f.name,
        type: f.type,
        method: f.method,
        description: f.description,
      })),
    contrast_guard_pattern:
      "Kuendigung stage requires ticket transition on update_status_box failure",
  };
}

export function forControlFlowInvestigator(input: {
  artifact: LeapingAgentSlice;
  causeArtifact: CauseFindingArtifact;
}) {
  return {
    cause_finding_artifact: {
      cause_class: input.causeArtifact.cause_class,
      cause_statement: input.causeArtifact.cause_statement,
      preserved_facts: input.causeArtifact.hypothesis_lifecycle.flatMap(
        (h) => h.preserved_facts,
      ),
    },
    ...stageGraphView(input.artifact),
    instruction:
      "Post ONE surface_candidate for a workflow_branch or state_transition that could emit the cause class.",
  };
}

export function forPolicyInvestigator(input: {
  artifact: LeapingAgentSlice;
  causeArtifact: CauseFindingArtifact;
}) {
  return {
    cause_finding_artifact: {
      cause_class: input.causeArtifact.cause_class,
      cause_statement: input.causeArtifact.cause_statement,
    },
    ...policyView(input.artifact),
    instruction:
      "Post ONE surface_candidate for prompt_policy or dialogue_stage policy gap.",
  };
}

export function forGuardInvestigator(input: {
  artifact: LeapingAgentSlice;
  causeArtifact: CauseFindingArtifact;
  runtimeToolAliases: Record<string, string>;
}) {
  return {
    cause_finding_artifact: {
      cause_class: input.causeArtifact.cause_class,
      cause_statement: input.causeArtifact.cause_statement,
    },
    ...guardView(input.artifact, input.runtimeToolAliases),
    instruction:
      "Post ONE surface_candidate for missing confirmation_guard or tool_contract gap.",
  };
}

export function bandThreadForLocalizationInvestigator(
  posts: BandPostContext[],
  role:
    | "control_flow_investigator"
    | "policy_investigator"
    | "guard_investigator"
    | "localization_judge",
) {
  return posts.map((p) => {
    const payload = p.payload as Record<string, unknown> | undefined;
    return {
      band_message_id: p.messageId,
      agent_role: p.agentRole,
      post_type: p.postType,
      summary:
        role === "localization_judge"
          ? payload
          : {
              surface_id: (payload as SurfaceCandidate)?.surface?.surface_id,
              mechanism_fit: (payload as SurfaceCandidate)?.surface
                ?.mechanism_fit_en,
              confidence: (payload as SurfaceCandidate)?.surface?.confidence,
              pointer: (payload as SurfaceCandidate)?.surface?.pointer
                ?.native_pointer,
            },
    };
  });
}

export function forLocalizationJudge(input: {
  causeArtifact: CauseFindingArtifact;
  bandThread: BandPostContext[];
  candidates: SurfaceCandidate[];
}) {
  return {
    cause_finding_artifact: input.causeArtifact,
    band_thread: bandThreadForLocalizationInvestigator(
      input.bandThread,
      "localization_judge",
    ),
    surface_candidates: input.candidates.map((c) => c.surface),
    instruction:
      "After surface attacks and eliminations: discover the implementation_mechanism that emerged from conflict (none proposed it initially), then localize to primary_surface + supporting_surfaces. Mechanism is the product; pointers are evidence.",
  };
}
