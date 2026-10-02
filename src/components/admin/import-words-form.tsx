"use client";

import { useActionState } from "react";

import { Field, Notice, SelectInput, SubmitButton, TextArea } from "@/components/ui/form";
import { importWordsAction } from "@/lib/admin/actions";
import { IDLE_ADMIN_STATE } from "@/lib/admin/types";

export function ImportWordsForm({ games }: { games: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(importWordsAction, IDLE_ADMIN_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Game" htmlFor="import-game">
          <SelectInput id="import-game" name="gameId" required>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Pool" htmlFor="import-pool">
          <SelectInput id="import-pool" name="pool" defaultValue="VALIDATION">
            <option value="VALIDATION">Valid guesses / dictionary</option>
            <option value="ANSWERS">Answer pool</option>
          </SelectInput>
        </Field>
      </div>

      <Field
        label="Words"
        htmlFor="import-csv"
        hint="Paste words separated by commas, spaces or new lines. Duplicates are ignored."
      >
        <TextArea
          id="import-csv"
          name="csv"
          placeholder={"crane\nslate\nadieu"}
          required
          data-testid="import-csv"
        />
      </Field>

      <Notice status={state.status} message={state.message} testId="import-notice" />

      <SubmitButton pending={pending} data-testid="import-submit" className="sm:w-auto">
        {pending ? "Importing…" : "Import words"}
      </SubmitButton>
    </form>
  );
}
