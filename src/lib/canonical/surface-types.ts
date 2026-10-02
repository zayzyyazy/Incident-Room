import { z } from "zod";

/** Platform-neutral surface types — adapters map native artifacts into these. */
export const CanonicalSurfaceTypeSchema = z.enum([
  "workflow_branch",
  "dialogue_stage",
  "prompt_policy",
  "tool_contract",
  "confirmation_guard",
  "state_transition",
  "error_handler",
]);

export type CanonicalSurfaceType = z.infer<typeof CanonicalSurfaceTypeSchema>;

export const AgentPlatformSchema = z.enum([
  "leaping",
  "retell",
  "vapi",
  "openai_agents",
  "langgraph",
  "crewai",
  "custom",
]);

export type AgentPlatform = z.infer<typeof AgentPlatformSchema>;

/** Canonical mechanism ids — Room 2 bridge vocabulary (platform-neutral). */
export const CanonicalMechanismIdSchema = z.enum([
  "confirmation_before_backend_success",
  "success_path_without_side_effect_guard",
  "dialogue_continues_after_tool_failure",
  "completion_flag_before_handoff",
  "tool_never_invoked_on_intended_path",
  "success_confirmation_on_unreachable_tool_path",
  "error_swallowed_without_customer_block",
  "healthy_call_no_customer_speech",
  "healthy_call_with_customer_speech",
]);

export type CanonicalMechanismId = z.infer<typeof CanonicalMechanismIdSchema>;

export const NativeSurfacePointerSchema = z.object({
  platform: AgentPlatformSchema,
  native_pointer: z.string(),
  native_label: z.string(),
  native_kind: z.string().optional(),
});

export const CanonicalSuspectSurfaceSchema = z.object({
  surface_id: z.string(),
  surface_type: CanonicalSurfaceTypeSchema,
  canonical_mechanism_id: CanonicalMechanismIdSchema.optional(),
  mechanism_fit_en: z.string(),
  fit_to_cause_class: z.string(),
  confidence: z.number().min(0).max(1),
  supported_by: z.array(z.string()),
  pointer: NativeSurfacePointerSchema,
  evidence: z
    .array(
      z.object({
        kind: z.string(),
        observed: z.string().optional(),
        missing: z.string().optional(),
        ref: z.string().optional(),
      }),
    )
    .optional(),
  cites_band_message_ids: z.array(z.string()).optional(),
});

export type CanonicalSuspectSurface = z.infer<typeof CanonicalSuspectSurfaceSchema>;

export const ImplementationMechanismSchema = z.object({
  canonical_id: CanonicalMechanismIdSchema,
  statement: z.string(),
  required_guard_missing: z.string().optional(),
});

export type ImplementationMechanism = z.infer<typeof ImplementationMechanismSchema>;
