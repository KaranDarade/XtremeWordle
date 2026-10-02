import { describe, expect, it } from "vitest";

import {
  AVATAR_CATEGORIES,
  avatarFromSeed,
  BACKGROUNDS,
  DEFAULT_AVATAR,
  FACE_SHAPES,
  HAIR_COLOURS,
  HAIRSTYLES,
  normalizeAvatar,
  SKIN_TONES,
} from "@/lib/avatar/config";

describe("normalizeAvatar", () => {
  it("fills in defaults for an empty input", () => {
    expect(normalizeAvatar(undefined)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({})).toEqual(DEFAULT_AVATAR);
  });

  it("keeps valid selections", () => {
    const config = normalizeAvatar({
      skin: "espresso",
      hairstyle: "curly",
      hairColour: "copper",
      background: "moss",
      face: "square",
      glasses: "round",
    });

    expect(config.skin).toBe("espresso");
    expect(config.hairstyle).toBe("curly");
    expect(config.hairColour).toBe("copper");
    expect(config.background).toBe("moss");
    expect(config.face).toBe("square");
    expect(config.glasses).toBe("round");
  });

  it("replaces unknown or hostile values with a valid option", () => {
    const config = normalizeAvatar({
      skin: "<script>",
      hairstyle: 42,
      glasses: { evil: true },
      background: "",
      mouth: null,
    });

    expect(SKIN_TONES.map((tone) => tone.id)).toContain(config.skin);
    expect(HAIRSTYLES).toContain(config.hairstyle);
    expect(["none", "round", "square"]).toContain(config.glasses);
    expect(BACKGROUNDS.map((background) => background.id)).toContain(config.background);
    expect(config.version).toBe(1);
  });

  it("always returns the complete set of fields", () => {
    const config = normalizeAvatar({ skin: "honey" });
    expect(Object.keys(config).sort()).toEqual(Object.keys(DEFAULT_AVATAR).sort());
  });
});

describe("avatarFromSeed", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarFromSeed("guest-abc")).toEqual(avatarFromSeed("guest-abc"));
  });

  it("differs across seeds", () => {
    const a = avatarFromSeed("guest-1");
    const b = avatarFromSeed("guest-2");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("always produces a valid config", () => {
    for (const seed of ["a", "b", "long-guest-token-value", "byte-bot", "🙂"]) {
      const config = avatarFromSeed(seed);
      expect(HAIR_COLOURS.map((colour) => colour.id)).toContain(config.hairColour);
      expect(FACE_SHAPES).toContain(config.face);
      expect(normalizeAvatar(config)).toEqual(config);
    }
  });
});

describe("AVATAR_CATEGORIES", () => {
  it("exposes a swatch list for every customisable field", () => {
    const keys = AVATAR_CATEGORIES.map((category) => category.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "skin",
        "face",
        "eyes",
        "brows",
        "mouth",
        "hairstyle",
        "hairColour",
        "facialHair",
        "glasses",
        "earrings",
        "headwear",
        "background",
      ]),
    );
    expect(keys).toHaveLength(12);
  });

  it("offers multiple options per category", () => {
    for (const category of AVATAR_CATEGORIES) {
      expect(category.options.length).toBeGreaterThan(1);
    }
  });

  it("produces a large combination space", () => {
    const combinations = AVATAR_CATEGORIES.reduce(
      (total, category) => total * category.options.length,
      1,
    );
    expect(combinations).toBeGreaterThan(150);
  });
});
