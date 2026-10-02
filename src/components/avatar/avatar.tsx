import {
  backgroundOf,
  hairColourOf,
  skinToneOf,
  type AvatarConfig,
  type BrowStyle,
  type EyeStyle,
  type FaceShape,
  type MouthStyle,
} from "@/lib/avatar/config";
import { cn } from "@/lib/utils";

/**
 * Parametric faux-3D avatar.
 *
 * Depth comes from layered fills with opacity (side shading, forehead
 * highlight, soft occlusion under the jaw) rather than SVG gradients, so no
 * element ids are needed and many avatars can share a page safely.
 *
 * `animated` enables the idle breath/blink loop and should only be used on
 * hero surfaces; lists render the identical artwork with animation off.
 */
export function Avatar({
  config,
  animated = false,
  className,
  testId,
}: {
  config: AvatarConfig;
  animated?: boolean;
  className?: string;
  testId?: string;
}) {
  const skin = skinToneOf(config);
  const hair = hairColourOf(config);
  const background = backgroundOf(config);

  return (
    <span
      className={cn("avatar", animated && "avatar-anim", className)}
      style={{ backgroundImage: `linear-gradient(150deg, ${background.from}, ${background.to})` }}
      data-testid={testId}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" focusable="false" role="presentation">
        {/* Shoulders ground the face and hide the neck seam. */}
        <path d="M24 120c3-17 18-25 36-25s33 8 36 25Z" fill={background.from} opacity="0.55" />
        <path d="M24 120c3-17 18-25 36-25s33 8 36 25Z" fill="#000" opacity="0.18" />

        {longHairBehind(config.hairstyle) ? <HairBack config={config} /> : null}

        <g className="avatar-head">
          {/* Neck + shadow under the jaw. */}
          <rect x="52" y="74" width="16" height="20" rx="7" fill={skin.shade} />
          <ellipse cx="60" cy="80" rx="17" ry="7" fill={skin.line} opacity="0.25" />

          <Ears config={config} />

          <FaceShapePath shape={config.face} skin={skin} />
          {/* Faux-3D shading: right side falls into shade, forehead catches light. */}
          <path d="M60 20c17 0 31 15 31 34 0 22-14 39-31 39Z" fill={skin.line} opacity="0.18" />
          <ellipse cx="47" cy="42" rx="15" ry="11" fill="#fff" opacity="0.14" />
          <ellipse cx="60" cy="92" rx="20" ry="6" fill={skin.line} opacity="0.12" />

          {config.facialHair === "stubble" ? (
            <path
              d="M32 62c2 24 14 38 28 38s26-14 28-38c-6 22-16 30-28 30s-22-8-28-30Z"
              fill={hair.shade}
              opacity="0.32"
            />
          ) : null}

          <Eyes style={config.eyes} />
          <Brows style={config.brows} colour={hair.shade} />
          <Nose skin={skin} />
          <Mouth style={config.mouth} skin={skin} />

          {config.facialHair === "moustache" ? (
            <path
              d="M48 74c4-3 8-3 12 0 4-3 8-3 12 0-3 5-8 7-12 4-4 3-9 1-12-4Z"
              fill={hair.base}
            />
          ) : null}
          {config.facialHair === "beard" ? (
            <path
              d="M33 60c1 27 13 43 27 43s26-16 27-43c-3 20-14 30-27 30s-24-10-27-30Z"
              fill={hair.base}
            />
          ) : null}

          <HairFront config={config} />
          <Earrings config={config} />
          <Glasses config={config} />
          <Headwear config={config} />
        </g>
      </svg>
    </span>
  );
}

function longHairBehind(style: AvatarConfig["hairstyle"]) {
  return style === "long" || style === "bob" || style === "ponytail";
}

function Ears({ config }: { config: AvatarConfig }) {
  const skin = skinToneOf(config);
  return (
    <>
      <ellipse cx="30" cy="60" rx="7" ry="9" fill={skin.base} />
      <ellipse cx="30" cy="60" rx="7" ry="9" fill={skin.line} opacity="0.2" />
      <ellipse cx="90" cy="60" rx="7" ry="9" fill={skin.base} />
      <ellipse cx="90" cy="60" rx="7" ry="9" fill={skin.line} opacity="0.35" />
    </>
  );
}

function FaceShapePath({ shape, skin }: { shape: FaceShape; skin: ReturnType<typeof skinToneOf> }) {
  if (shape === "round") return <ellipse cx="60" cy="57" rx="33" ry="33" fill={skin.base} />;
  if (shape === "square") {
    return (
      <path
        d="M28 44c0-14 14-24 32-24s32 10 32 24v26c0 17-14 29-32 29s-32-12-32-29Z"
        fill={skin.base}
      />
    );
  }
  return <ellipse cx="60" cy="56" rx="30" ry="35" fill={skin.base} />;
}

function eyeGeometry(style: EyeStyle) {
  switch (style) {
    case "almond":
      return { rx: 7.6, ry: 4.6, lid: 1.6 };
    case "wide":
      return { rx: 8, ry: 6.6, lid: 0.6 };
    case "sleepy":
      return { rx: 7, ry: 3.8, lid: 2.2 };
    default:
      return { rx: 7, ry: 6, lid: 1 };
  }
}

function Eyes({ style }: { style: EyeStyle }) {
  const { rx, ry, lid } = eyeGeometry(style);

  return (
    <>
      {[
        { key: "left", x: 47 },
        { key: "right", x: 73 },
      ].map((eye) => (
        <g key={eye.key} className={cn("avatar-eye", `avatar-eye-${eye.key}`)}>
          <ellipse cx={eye.x} cy={56} rx={rx} ry={ry} fill="#fdf7ef" />
          <circle cx={eye.x} cy={56} r={3.4} fill="#4a2f1c" />
          <circle cx={eye.x} cy={56} r={1.6} fill="#1b120c" />
          <circle cx={eye.x - 1.2} cy={54.8} r={1} fill="#fff" opacity="0.85" />
          {lid > 0 ? (
            <path
              d={`M${eye.x - rx} ${56 - ry + lid} q${rx} -${lid * 2.4} ${rx * 2} 0`}
              stroke="#000"
              strokeOpacity="0.14"
              strokeWidth={lid}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </g>
      ))}
    </>
  );
}

function Brows({ style, colour }: { style: BrowStyle; colour: string }) {
  const height = style === "thick" ? 5 : 3.4;
  const arch = style === "arched" ? 4 : style === "straight" ? 0.6 : 1.6;

  return (
    <>
      <rect x="39" y={45 - arch} width="16" height={height} rx={height / 2} fill={colour} />
      <rect x="65" y={45 - arch} width="16" height={height} rx={height / 2} fill={colour} />
    </>
  );
}

function Nose({ skin }: { skin: ReturnType<typeof skinToneOf> }) {
  return (
    <>
      <path
        d="M58 58c-1 5-3 8-5 10"
        stroke={skin.line}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      <ellipse cx="57" cy="70" rx="3" ry="1.8" fill={skin.line} opacity="0.5" />
      <ellipse cx="63" cy="70" rx="3" ry="1.8" fill={skin.line} opacity="0.5" />
    </>
  );
}

function Mouth({ style, skin }: { style: MouthStyle; skin: ReturnType<typeof skinToneOf> }) {
  const lip = "#9c5a52";

  if (style === "grin") {
    return (
      <>
        <path d="M48 76q12 12 24 0Z" fill="#5a2b26" />
        <path
          d="M49 76.6q11 3 22 0"
          stroke="#fff"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      </>
    );
  }
  if (style === "neutral") {
    return <path d="M50 80h20" stroke={lip} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
  if (style === "smirk") {
    return (
      <path d="M50 79q9 6 19-3" stroke={lip} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    );
  }
  return (
    <>
      <path d="M49 78q11 9 22 0" stroke={lip} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M49 78q11 -2 22 0" stroke={skin.line} strokeWidth="1.2" fill="none" opacity="0.5" />
    </>
  );
}

function HairFront({ config }: { config: AvatarConfig }) {
  const hair = hairColourOf(config);

  switch (config.hairstyle) {
    case "buzz":
      return (
        <path
          d="M30 48c1-17 14-27 30-27s29 10 30 27c-4-13-15-20-30-20s-26 7-30 20Z"
          fill={hair.base}
        />
      );
    case "bald":
      return null;
    case "curly":
      return (
        <g fill={hair.base}>
          <circle cx="36" cy="40" r="9" />
          <circle cx="48" cy="30" r="10" />
          <circle cx="62" cy="27" r="10" />
          <circle cx="76" cy="32" r="9" />
          <circle cx="85" cy="43" r="8" />
        </g>
      );
    case "short":
      return (
        <path
          d="M29 50c0-19 14-31 31-31s31 12 31 31c-4-8-9-13-16-15-6 4-24 6-34 2-6 3-9 6-12 13Z"
          fill={hair.base}
        />
      );
    case "bob":
      return (
        <path
          d="M27 56c0-21 15-34 33-34s33 13 33 34c0 8-3 13-6 16 2-14-3-26-9-30-9 5-29 5-38 0-6 5-10 16-8 30-3-3-5-8-5-16Z"
          fill={hair.base}
        />
      );
    case "long":
      return (
        <path
          d="M26 60c0-24 16-39 34-39s34 15 34 39c0 12-2 20-5 26 1-18-2-32-8-38-9 6-33 6-42 0-6 6-9 20-8 38-3-6-5-14-5-26Z"
          fill={hair.base}
        />
      );
    case "ponytail":
      return (
        <path
          d="M30 48c0-18 14-30 30-30s30 12 30 30c-4-9-13-15-30-15s-26 6-30 15Z"
          fill={hair.base}
        />
      );
    default:
      return null;
  }
}

function HairBack({ config }: { config: AvatarConfig }) {
  const hair = hairColourOf(config);

  if (config.hairstyle === "ponytail") {
    return (
      <g fill={hair.shade}>
        <ellipse cx="92" cy="66" rx="9" ry="15" />
        <ellipse cx="96" cy="86" rx="7" ry="13" />
      </g>
    );
  }

  const width = config.hairstyle === "long" ? 34 : 30;
  return (
    <path
      d={`M${60 - width} 58c0-26 12-42 ${width} -42s${width} 16 ${width} 42v${config.hairstyle === "long" ? 34 : 18}c-8 6-14 6-18 0 3-10 4-24-3-30-8 6-22 6-${width - 4} 2 2 8 1 20 4 28-4 6-12 6-19 0Z`}
      fill={hair.shade}
    />
  );
}

function Earrings({ config }: { config: AvatarConfig }) {
  if (config.earrings === "studs") {
    return (
      <>
        <circle cx="30" cy="68" r="2.6" fill="#e6c15c" />
        <circle cx="90" cy="68" r="2.6" fill="#e6c15c" />
      </>
    );
  }
  if (config.earrings === "hoops") {
    return (
      <>
        <circle cx="30" cy="72" r="5" stroke="#e6c15c" strokeWidth="2" fill="none" />
        <circle cx="90" cy="72" r="5" stroke="#e6c15c" strokeWidth="2" fill="none" />
      </>
    );
  }
  return null;
}

function Glasses({ config }: { config: AvatarConfig }) {
  if (config.glasses === "none") return null;

  if (config.glasses === "square") {
    return (
      <g stroke="#2f2118" strokeWidth="2.4" fill="rgba(255,255,255,0.12)">
        <rect x="36" y="48" width="24" height="18" rx="5" />
        <rect x="60" y="48" width="24" height="18" rx="5" />
        <path d="M60 56h0M84 57l6-2M36 57l-6-2" />
      </g>
    );
  }

  return (
    <g stroke="#2f2118" strokeWidth="2.4" fill="rgba(255,255,255,0.12)">
      <circle cx="47" cy="56" r="10" />
      <circle cx="73" cy="56" r="10" />
      <path d="M57 56h6M37 55l-6-2M83 55l6-2" />
    </g>
  );
}

function Headwear({ config }: { config: AvatarConfig }) {
  if (config.headwear === "cap") {
    return (
      <g>
        <path d="M28 46c0-17 14-28 32-28s32 11 32 28Z" fill="#8a5a2b" />
        <path d="M60 18c14 0 25 6 30 15H30c5-9 16-15 30-15Z" fill="#a9744f" opacity="0.5" />
        <path d="M86 44h20a4 4 0 0 1 0 8H84Z" fill="#6f4426" />
      </g>
    );
  }
  if (config.headwear === "beanie") {
    return (
      <g>
        <path d="M30 44c0-16 13-26 30-26s30 10 30 26Z" fill="#4f6b32" />
        <rect x="28" y="40" width="64" height="10" rx="5" fill="#3f5628" />
        <circle cx="60" cy="14" r="6" fill="#8fa863" />
      </g>
    );
  }
  return null;
}
