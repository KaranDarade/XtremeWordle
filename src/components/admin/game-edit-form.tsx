"use client";

import { useActionState } from "react";

import { Field, Notice, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { updateGameAction } from "@/lib/admin/actions";
import { IDLE_ADMIN_STATE } from "@/lib/admin/types";

export function GameEditForm({
  game,
}: {
  game: {
    id: string;
    name: string;
    tagline: string | null;
    description: string | null;
    sortOrder: number;
  };
}) {
  const [state, formAction, pending] = useActionState(updateGameAction, IDLE_ADMIN_STATE);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={game.id} />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Name" htmlFor={`name-${game.id}`}>
          <TextInput id={`name-${game.id}`} name="name" defaultValue={game.name} required />
        </Field>
        <Field label="Sort" htmlFor={`sort-${game.id}`}>
          <TextInput
            id={`sort-${game.id}`}
            name="sortOrder"
            type="number"
            defaultValue={game.sortOrder}
            className="sm:w-24"
          />
        </Field>
      </div>

      <Field label="Tagline" htmlFor={`tagline-${game.id}`}>
        <TextInput id={`tagline-${game.id}`} name="tagline" defaultValue={game.tagline ?? ""} />
      </Field>

      <Field label="Description" htmlFor={`desc-${game.id}`}>
        <TextArea id={`desc-${game.id}`} name="description" defaultValue={game.description ?? ""} />
      </Field>

      <Notice status={state.status} message={state.message} testId={`game-notice-${game.id}`} />

      <SubmitButton pending={pending} className="sm:w-auto" data-testid={`save-game-${game.id}`}>
        {pending ? "Saving…" : "Save game"}
      </SubmitButton>
    </form>
  );
}
