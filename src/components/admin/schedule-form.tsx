"use client";

import { useActionState, useState } from "react";

import { Field, Notice, SelectInput, SubmitButton, TextInput } from "@/components/ui/form";
import { assignWordAction } from "@/lib/admin/actions";
import { IDLE_ADMIN_STATE } from "@/lib/admin/types";

export function ScheduleForm({
  games,
  defaultDate,
}: {
  games: { slug: string; name: string }[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(assignWordAction, IDLE_ADMIN_STATE);
  const [mode, setMode] = useState<"daily" | "twelve-hour">("daily");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Game" htmlFor="gameSlug">
          <SelectInput id="gameSlug" name="gameSlug" required>
            {games.map((game) => (
              <option key={game.slug} value={game.slug}>
                {game.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Rotation" htmlFor="mode">
          <SelectInput
            id="mode"
            name="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as "daily" | "twelve-hour")}
          >
            <option value="daily">Daily (00:00 IST)</option>
            <option value="twelve-hour">Every 12 hours</option>
          </SelectInput>
        </Field>

        <Field label="Date (IST)" htmlFor="date">
          <TextInput id="date" name="date" type="date" defaultValue={defaultDate} required />
        </Field>

        {mode === "twelve-hour" ? (
          <Field label="Slot" htmlFor="half">
            <SelectInput id="half" name="half" defaultValue="00">
              <option value="00">00:00 IST</option>
              <option value="12">12:00 IST</option>
            </SelectInput>
          </Field>
        ) : (
          <input type="hidden" name="half" value="00" />
        )}

        <Field label="Word" htmlFor="word" hint="Must already exist in the game's word list.">
          <TextInput
            id="word"
            name="word"
            placeholder="crane"
            autoComplete="off"
            required
            data-testid="schedule-word"
          />
        </Field>
      </div>

      <Notice status={state.status} message={state.message} />

      <SubmitButton pending={pending} data-testid="schedule-submit" className="sm:w-auto">
        {pending ? "Saving…" : "Assign word"}
      </SubmitButton>
    </form>
  );
}
