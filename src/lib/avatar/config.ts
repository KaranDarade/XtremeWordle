/**
 * Avatar definition and options.
 *
 * The avatar is a parametric SVG — no images, no WebGL — so it costs a couple of
 * kilobytes, renders at any size and animates with `transform`/`opacity` only.
 * This module is free of Prisma imports so it is safe in client bundles and
 * easy to unit test.
 */

export const SKIN_TONES = [
  { id: "porcelain", base: "#f7d9c6", shade: "#dfb49b", line: "#c8927a" },
  { id: "sand", base: "#eabd99", shade: "#cd9a72", line: "#a9744f" },
  { id: "honey", base: "#d59d6c", shade: "#b57c4c", line: "#8d5a31" },
  { id: "bronze", base: "#aa7341", shade: "#8a5628", line: "#653a17" },
  { id: "espresso", base: "#73482a", shade: "#55321c", line: "#3a1f0e" },
] as const;

export const HAIR_COLOURS = [
  { id: "espresso", base: "#2f2118", shade: "#1b120c" },
  { id: "chestnut", base: "#6d4527", shade: "#4a2c16" },
  { id: "honey", base: "#bc8745", shade: "#936330" },
  { id: "ash", base: "#8f8d88", shade: "#696863" },
  { id: "copper", base: "#a6562b", shade: "#7b3c1c" },
] as const;

export const BACKGROUNDS = [
  { id: "ember", from: "#8a5a2b", to: "#c9962f" },
  { id: "walnut", from: "#4a2f1c", to: "#8a5a2b" },
  { id: "moss", from: "#4f6b32", to: "#8fa863" },
  { id: "dusk", from: "#3a2c22", to: "#6f4830" },
  { id: "clay", from: "#a0522d", to: "#d98a55" },
  { id: "charcoal", from: "#2b2622", to: "#5a5148" },
] as const;

export const FACE_SHAPES = ["round", "oval", "square"] as const;
export const EYES = ["round", "almond", "wide", "sleepy"] as const;
export const BROWS = ["straight", "arched", "thick"] as const;
export const MOUTHS = ["smile", "grin", "neutral", "smirk"] as const;
export const HAIRSTYLES = ["short", "buzz", "bob", "curly", "long", "ponytail", "bald"] as const;
export const FACIAL_HAIR = ["none", "stubble", "moustache", "beard"] as const;
export const GLASSES = ["none", "round", "square"] as const;
export const EARRINGS = ["none", "studs", "hoops"] as const;
export const HEADWEAR = ["none", "cap", "beanie"] as const;

export type SkinToneId = (typeof SKIN_TONES)[number]["id"];
export type HairColourId = (typeof HAIR_COLOURS)[number]["id"];
export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];
export type FaceShape = (typeof FACE_SHAPES)[number];
export type EyeStyle = (typeof EYES)[number];
export type BrowStyle = (typeof BROWS)[number];
export type MouthStyle = (typeof MOUTHS)[number];
export type HairStyle = (typeof HAIRSTYLES)[number];
export type FacialHairStyle = (typeof FACIAL_HAIR)[number];
export type GlassesStyle = (typeof GLASSES)[number];
export type EarringStyle = (typeof EARRINGS)[number];
export type HeadwearStyle = (typeof HEADWEAR)[number];

export interface AvatarConfig {
  version: 1;
  skin: SkinToneId;
  hairColour: HairColourId;
  background: BackgroundId;
  face: FaceShape;
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  hairstyle: HairStyle;
  facialHair: FacialHairStyle;
  glasses: GlassesStyle;
  earrings: EarringStyle;
  headwear: HeadwearStyle;
}

export const AVATAR_CATEGORIES = [
  { key: "skin", label: "Skin", options: SKIN_TONES.map((tone) => tone.id) },
  { key: "face", label: "Face", options: FACE_SHAPES },
  { key: "eyes", label: "Eyes", options: EYES },
  { key: "brows", label: "Brows", options: BROWS },
  { key: "mouth", label: "Mouth", options: MOUTHS },
  { key: "hairstyle", label: "Hair", options: HAIRSTYLES },
  { key: "hairColour", label: "Hair colour", options: HAIR_COLOURS.map((c) => c.id) },
  { key: "facialHair", label: "Facial hair", options: FACIAL_HAIR },
  { key: "glasses", label: "Glasses", options: GLASSES },
  { key: "earrings", label: "Earrings", options: EARRINGS },
  { key: "headwear", label: "Headwear", options: HEADWEAR },
  { key: "background", label: "Background", options: BACKGROUNDS.map((b) => b.id) },
] as const satisfies readonly {
  key: keyof AvatarConfig;
  label: string;
  options: readonly string[];
}[];

const pick = <T extends readonly { id: string }[]>(list: T, id: unknown, fallbackIndex = 0) =>
  (list.find((entry) => entry.id === id) ?? list[fallbackIndex]).id;

function pickFrom<T extends readonly string[]>(
  list: T,
  id: unknown,
  fallback?: T[number],
): T[number] {
  if (typeof id === "string" && (list as readonly string[]).includes(id)) return id as T[number];
  return (fallback ?? list[0]) as T[number];
}

export const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  skin: "sand",
  hairColour: "espresso",
  background: "ember",
  face: "oval",
  eyes: "round",
  brows: "straight",
  mouth: "smile",
  hairstyle: "short",
  facialHair: "none",
  glasses: "none",
  earrings: "none",
  headwear: "none",
};

/** Coerces untrusted JSON (or a partial update) into a complete, valid config. */
export function normalizeAvatar(input: unknown): AvatarConfig {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<AvatarConfig>;

  return {
    version: 1,
    skin: pick(SKIN_TONES, raw.skin, 1) as SkinToneId,
    hairColour: pick(HAIR_COLOURS, raw.hairColour, 0) as HairColourId,
    background: pick(BACKGROUNDS, raw.background, 0) as BackgroundId,
    face: pickFrom(FACE_SHAPES, raw.face, "oval"),
    eyes: pickFrom(EYES, raw.eyes),
    brows: pickFrom(BROWS, raw.brows),
    mouth: pickFrom(MOUTHS, raw.mouth),
    hairstyle: pickFrom(HAIRSTYLES, raw.hairstyle),
    facialHair: pickFrom(FACIAL_HAIR, raw.facialHair),
    glasses: pickFrom(GLASSES, raw.glasses),
    earrings: pickFrom(EARRINGS, raw.earrings),
    headwear: pickFrom(HEADWEAR, raw.headwear),
  };
}

/** Stable 32-bit hash (FNV-1a) so a seed always yields the same avatar. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function indexFrom(hash: number, shift: number, length: number): number {
  return Math.floor((hash >>> shift) % length);
}

/**
 * Deterministic avatar for guests and bots: the same seed (guest token, bot
 * name) always produces the same face.
 */
export function avatarFromSeed(seed: string): AvatarConfig {
  const hash = hashSeed(seed);
  const at = (shift: number, length: number) => indexFrom(hash, shift, length);

  return normalizeAvatar({
    skin: SKIN_TONES[at(0, SKIN_TONES.length)].id,
    hairColour: HAIR_COLOURS[at(4, HAIR_COLOURS.length)].id,
    background: BACKGROUNDS[at(8, BACKGROUNDS.length)].id,
    face: FACE_SHAPES[at(12, FACE_SHAPES.length)],
    eyes: EYES[at(10, EYES.length)],
    brows: BROWS[at(14, BROWS.length)],
    mouth: MOUTHS[at(16, MOUTHS.length)],
    hairstyle: HAIRSTYLES[at(18, HAIRSTYLES.length)],
    facialHair: FACIAL_HAIR[at(20, FACIAL_HAIR.length)],
    glasses: GLASSES[at(22, GLASSES.length)],
    earrings: EARRINGS[at(24, EARRINGS.length)],
    headwear: HEADWEAR[at(6, HEADWEAR.length)],
  });
}

export function skinToneOf(config: AvatarConfig) {
  return SKIN_TONES.find((tone) => tone.id === config.skin) ?? SKIN_TONES[0];
}

export function hairColourOf(config: AvatarConfig) {
  return HAIR_COLOURS.find((colour) => colour.id === config.hairColour) ?? HAIR_COLOURS[0];
}

export function backgroundOf(config: AvatarConfig) {
  return BACKGROUNDS.find((background) => background.id === config.background) ?? BACKGROUNDS[0];
}
