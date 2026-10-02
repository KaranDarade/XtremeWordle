"use client";

import { Dices, Shuffle } from "lucide-react";
import { useActionState, useState } from "react";

import { Avatar } from "@/components/avatar/avatar";
import { Notice, SubmitButton } from "@/components/ui/form";
import { saveAvatarAction, type AvatarActionState } from "@/lib/avatar/actions";
import {
  AVATAR_CATEGORIES,
  BACKGROUNDS,
  HAIR_COLOURS,
  normalizeAvatar,
  SKIN_TONES,
  type AvatarConfig,
} from "@/lib/avatar/config";
import { cn } from "@/lib/utils";

const IDLE: AvatarActionState = { status: "idle" };

function swatchColour(category: string, option: string): string | null {
  if (category === "skin") return SKIN_TONES.find((tone) => tone.id === option)?.base ?? null;
  if (category === "hairColour") {
    return HAIR_COLOURS.find((colour) => colour.id === option)?.base ?? null;
  }
  if (category === "background") {
    const background = BACKGROUNDS.find((entry) => entry.id === option);
    return background ? `linear-gradient(150deg, ${background.from}, ${background.to})` : null;
  }
  return null;
}

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AvatarBuilder({ initial }: { initial: AvatarConfig }) {
  const [config, setConfig] = useState(initial);
  const [state, formAction, pending] = useActionState(saveAvatarAction, IDLE);

  function update<K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) {
    setConfig((previous) => ({ ...previous, [key]: value }));
  }

  function randomise() {
    const any = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

    setConfig(
      normalizeAvatar({
        skin: any(SKIN_TONES).id,
        hairColour: any(HAIR_COLOURS).id,
        background: any(BACKGROUNDS).id,
        face: any(["round", "oval", "square"]),
        eyes: any(["round", "almond", "wide", "sleepy"]),
        brows: any(["straight", "arched", "thick"]),
        mouth: any(["smile", "grin", "neutral", "smirk"]),
        hairstyle: any(["short", "buzz", "bob", "curly", "long", "ponytail", "bald"]),
        facialHair: any(["none", "stubble", "moustache", "beard"]),
        glasses: any(["none", "round", "square"]),
        earrings: any(["none", "studs", "hoops"]),
        headwear: any(["none", "cap", "beanie"]),
      }),
    );
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Every field travels with the form. */}
      {AVATAR_CATEGORIES.map((category) => (
        <input key={category.key} type="hidden" name={category.key} value={config[category.key]} />
      ))}

      <div className="flex flex-col items-center gap-3">
        <Avatar
          config={config}
          animated
          testId="avatar-preview"
          className="size-40 shadow-lg sm:size-48"
        />
        <button
          type="button"
          onClick={randomise}
          data-testid="avatar-randomise"
          className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold"
        >
          <Shuffle className="size-4" />
          Surprise me
        </button>
        <p className="text-center text-xs text-muted">
          Your avatar is your profile picture everywhere you play.
        </p>
      </div>

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {AVATAR_CATEGORIES.map((category) => (
            <div key={category.key}>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                {category.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {category.options.map((option) => {
                  const colour = swatchColour(category.key, option);
                  const selected = config[category.key] === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      data-testid={`avatar-${category.key}-${option}`}
                      onClick={() =>
                        update(category.key, option as AvatarConfig[typeof category.key])
                      }
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                        colour ? "size-8 p-0" : "glass",
                        selected
                          ? "ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--background)]"
                          : "opacity-80 hover:opacity-100",
                      )}
                      style={colour ? { background: colour } : undefined}
                      title={label(option)}
                    >
                      {colour ? <span className="sr-only">{label(option)}</span> : label(option)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Notice status={state.status} message={state.message} testId="avatar-notice" />

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} className="sm:w-auto" data-testid="avatar-save">
            {pending ? "Saving…" : "Save avatar"}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfig(normalizeAvatar({}))}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            <Dices className="size-4" />
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}
