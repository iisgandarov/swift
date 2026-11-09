"use client";

/** Hands text from the voice screen to the text screen (e.g. a transcript to fix by hand). */
let pending: string | null = null;

export function setTextDraft(text: string) {
  pending = text;
}

export function takeTextDraft(): string | null {
  const t = pending;
  pending = null;
  return t;
}
