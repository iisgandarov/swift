"use client";

import { emptyForm, ItemForm } from "./item-form";
import { FormFrame } from "./form-frame";

export function NewTaskScreen({ startVoice: _startVoice }: { startVoice: boolean }) {
  return (
    <FormFrame>
      <ItemForm initial={emptyForm()} />
    </FormFrame>
  );
}
