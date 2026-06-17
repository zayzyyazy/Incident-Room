import { AgentSlotId } from "@/lib/demo/game-level";
import { StageSlot } from "@/lib/demo/game-level-types";

type CrewmateHat =
  | "captain"
  | "courier"
  | "headset"
  | "hardhat"
  | "flowchart"
  | "shield"
  | "none";

type CrewColors = { body: string; shade: string; visor: string };

const CREW_COLORS: Record<string, CrewColors> = {
  incident_room: { body: "#7B3FF2", shade: "#5A2DB8", visor: "#9EEAFF" },
  communication_investigator: { body: "#38FEDC", shade: "#22B8A8", visor: "#B8F8FF" },
  execution_investigator: { body: "#EF7D0D", shade: "#C4650A", visor: "#FFE4B8" },
  workflow_investigator: { body: "#F5F557", shade: "#C9C948", visor: "#FFFDE8" },
  policy_investigator: { body: "#E11D48", shade: "#9F1239", visor: "#FFE4E8" },
  evidence_normalizer: { body: "#8496AF", shade: "#5E6D82", visor: "#D8EEFF" },
  claim_tracer: { body: "#38FEDC", shade: "#22B8A8", visor: "#B8F8FF" },
  backend_witness: { body: "#EF7D0D", shade: "#C4650A", visor: "#FFE4B8" },
  causal_judge: { body: "#7B3FF2", shade: "#5A2DB8", visor: "#9EEAFF" },
  unknown: { body: "#6B7280", shade: "#4B5563", visor: "#D1D5DB" },
};

const HAT_BY_SLOT: Record<string, CrewmateHat> = {
  incident_room: "captain",
  evidence_normalizer: "courier",
  communication_investigator: "headset",
  claim_tracer: "headset",
  execution_investigator: "hardhat",
  backend_witness: "hardhat",
  workflow_investigator: "flowchart",
  policy_investigator: "shield",
  causal_judge: "captain",
  unknown: "none",
};

function CrewmateHatSvg({ hat, colors }: { hat: CrewmateHat; colors: CrewColors }) {
  if (hat === "captain") {
    return (
      <g>
        <path d="M26 14 L34 6 L42 14 L40 16 L34 10 L28 16 Z" fill={colors.shade} />
        <ellipse cx="34" cy="16" rx="12" ry="3" fill={colors.shade} />
        <circle cx="34" cy="8" r="2" fill="#FBBF24" />
      </g>
    );
  }
  if (hat === "courier") {
    return (
      <g>
        <rect x="44" y="36" width="14" height="12" rx="2" fill={colors.shade} />
        <rect x="46" y="38" width="10" height="2" fill={colors.body} opacity={0.5} />
        <rect x="46" y="42" width="8" height="2" fill={colors.body} opacity={0.5} />
      </g>
    );
  }
  if (hat === "headset") {
    return (
      <g>
        <path
          d="M22 24 Q34 16 46 24"
          fill="none"
          stroke={colors.shade}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="18" y="22" width="6" height="10" rx="2" fill={colors.shade} />
        <rect x="44" y="22" width="6" height="10" rx="2" fill={colors.shade} />
        <circle cx="16" cy="30" r="2" fill={colors.body} />
      </g>
    );
  }
  if (hat === "hardhat") {
    return (
      <g>
        <path d="M24 18 Q34 10 44 18 L42 20 Q34 14 26 20 Z" fill="#FBBF24" />
        <rect x="22" y="18" width="24" height="4" rx="2" fill="#E8954A" />
      </g>
    );
  }
  if (hat === "flowchart") {
    return (
      <g>
        <circle cx="28" cy="12" r="3" fill="#FBBF24" />
        <circle cx="40" cy="12" r="3" fill="#FBBF24" />
        <line x1="31" y1="12" x2="37" y2="12" stroke="#FBBF24" strokeWidth="2" />
        <line x1="34" y1="12" x2="34" y2="16" stroke="#FBBF24" strokeWidth="2" />
        <circle cx="34" cy="18" r="3" fill="#FBBF24" />
      </g>
    );
  }
  if (hat === "shield") {
    return (
      <g>
        <path d="M28 8 L34 18 L28 22 L22 18 Z" fill="#FBBF24" stroke={colors.shade} strokeWidth="1" />
        <rect x="26" y="18" width="4" height="4" fill={colors.shade} />
      </g>
    );
  }
  return null;
}

/** Side-view Among Us crewmate (canonical profile). */
function CrewmateSide({
  colors,
  hat,
  speaking,
  ghost,
  facing,
}: {
  colors: CrewColors;
  hat: CrewmateHat;
  speaking: boolean;
  ghost?: boolean;
  facing: "left" | "right";
}) {
  const flip = facing === "left" ? "scale(-1,1) translate(-68,0)" : undefined;

  return (
    <g transform={flip}>
      <ellipse cx="34" cy="76" rx="15" ry="3.5" fill="#000" opacity={ghost ? 0.08 : 0.22} />

      {/* backpack */}
      <path
        d="M16 34 Q12 46 14 60 L20 60 Q18 46 20 34 Z"
        fill={ghost ? "none" : colors.shade}
        stroke={ghost ? colors.body : undefined}
        strokeWidth={ghost ? 1.5 : 0}
        strokeDasharray={ghost ? "3 2" : undefined}
        opacity={ghost ? 0.45 : 1}
      />

      {/* body */}
      <path
        d="M20 30
           C20 18, 30 12, 40 14
           C56 16, 64 30, 64 44
           C64 58, 54 66, 38 68
           C26 68, 20 58, 20 44 Z"
        fill={ghost ? "none" : colors.body}
        stroke={ghost ? colors.body : colors.shade}
        strokeWidth={ghost ? 2 : 0}
        strokeDasharray={ghost ? "4 3" : undefined}
        opacity={ghost ? 0.4 : 1}
      />

      {/* legs */}
      <rect
        x="26"
        y="62"
        width="11"
        height="13"
        rx="4"
        fill={ghost ? "none" : colors.body}
        stroke={ghost ? colors.body : undefined}
        strokeWidth={ghost ? 1.5 : 0}
        opacity={ghost ? 0.4 : 1}
      />
      <rect
        x="40"
        y="62"
        width="11"
        height="13"
        rx="4"
        fill={ghost ? "none" : colors.body}
        stroke={ghost ? colors.body : undefined}
        strokeWidth={ghost ? 1.5 : 0}
        opacity={ghost ? 0.4 : 1}
      />

      {/* visor */}
      <path
        d="M46 24
           C56 22, 62 30, 60 38
           C58 46, 48 48, 40 44
           C34 38, 36 28, 46 24 Z"
        fill={ghost ? "none" : colors.visor}
        stroke={ghost ? colors.visor : "#7DD3FC"}
        strokeWidth={ghost ? 1.5 : 1}
        opacity={ghost ? 0.35 : 1}
      />
      {!ghost ? (
        <>
          <ellipse cx="54" cy="30" rx="3.5" ry="6" fill="white" opacity={0.55} />
          <ellipse cx="48" cy="36" rx="2" ry="3" fill="white" opacity={0.25} />
        </>
      ) : null}

      {!ghost ? <CrewmateHatSvg hat={hat} colors={colors} /> : null}

      {speaking && !ghost ? (
        <g className="animate-crew-talk-dots">
          <circle cx="58" cy="14" r="2" fill="white" />
          <circle cx="64" cy="12" r="2" fill="white" opacity={0.8} />
          <circle cx="70" cy="14" r="2" fill="white" opacity={0.6} />
        </g>
      ) : null}
    </g>
  );
}

/** Front-view crewmate for center stage positions. */
function CrewmateFront({
  colors,
  hat,
  speaking,
  ghost,
}: {
  colors: CrewColors;
  hat: CrewmateHat;
  speaking: boolean;
  ghost?: boolean;
}) {
  return (
    <g>
      <ellipse cx="34" cy="76" rx="16" ry="3.5" fill="#000" opacity={ghost ? 0.08 : 0.22} />
      <path
        d="M18 36
           C18 20, 34 10, 50 10
           C66 10, 72 24, 72 40
           C72 58, 58 68, 34 68
           C14 68, 18 52, 18 36 Z"
        fill={ghost ? "none" : colors.body}
        stroke={ghost ? colors.body : colors.shade}
        strokeWidth={ghost ? 2 : 0}
        strokeDasharray={ghost ? "4 3" : undefined}
        opacity={ghost ? 0.4 : 1}
      />
      <rect x="24" y="62" width="10" height="13" rx="4" fill={ghost ? "none" : colors.body} stroke={ghost ? colors.body : undefined} strokeWidth={ghost ? 1.5 : 0} opacity={ghost ? 0.4 : 1} />
      <rect x="34" y="62" width="10" height="13" rx="4" fill={ghost ? "none" : colors.body} stroke={ghost ? colors.body : undefined} strokeWidth={ghost ? 1.5 : 0} opacity={ghost ? 0.4 : 1} />
      <path
        d="M22 28 C22 18, 34 14, 46 14 C58 14, 62 22, 60 30 C58 38, 46 42, 34 42 C24 42, 20 36, 22 28 Z"
        fill={ghost ? "none" : colors.visor}
        stroke={ghost ? colors.visor : "#7DD3FC"}
        strokeWidth={ghost ? 1.5 : 1}
        opacity={ghost ? 0.35 : 1}
      />
      {!ghost ? (
        <>
          <ellipse cx="40" cy="24" rx="8" ry="4" fill="white" opacity={0.5} />
          <CrewmateHatSvg hat={hat} colors={colors} />
        </>
      ) : null}
      {speaking && !ghost ? (
        <text x="34" y="8" textAnchor="middle" fontSize="10" fill="white" className="animate-crew-talk-dots">
          ...
        </text>
      ) : null}
    </g>
  );
}

export function GameCharacterSprite({
  slotId,
  slot,
  speaking,
  idle,
  ghost,
  facing = "right",
  size = "stage",
}: {
  slotId: AgentSlotId;
  slot: StageSlot;
  speaking: boolean;
  idle?: boolean;
  ghost?: boolean;
  facing?: "left" | "right" | "center";
  size?: "stage" | "party" | "tiny";
}) {
  const colors = CREW_COLORS[slotId] ?? CREW_COLORS.unknown;
  const hat = HAT_BY_SLOT[slotId] ?? "none";
  const dimmed = idle || ghost;

  const sizeClass =
    size === "party"
      ? "h-9 w-9"
      : size === "tiny"
        ? "h-7 w-7"
        : speaking
          ? "h-[5.75rem] w-[4.5rem]"
          : "h-[5rem] w-10";

  const animClass = ghost
    ? ""
    : speaking
      ? "animate-crew-speak"
      : "animate-crew-idle";

  return (
    <svg
      viewBox="0 0 68 80"
      className={`${sizeClass} ${animClass} drop-shadow-lg ${dimmed && !ghost ? "opacity-70" : ""}`}
      aria-hidden
    >
      {facing === "center" ? (
        <CrewmateFront colors={colors} hat={hat} speaking={speaking} ghost={ghost} />
      ) : (
        <CrewmateSide
          colors={colors}
          hat={hat}
          speaking={speaking}
          ghost={ghost}
          facing={facing}
        />
      )}
    </svg>
  );
}

/** Mini crewmate for party roster — exports colors for UI chips */
export function crewmateSwatch(slotId: AgentSlotId): string {
  return CREW_COLORS[slotId]?.body ?? CREW_COLORS.unknown.body;
}
