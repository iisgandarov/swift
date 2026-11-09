"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, FileText, Flag, Folder } from "lucide-react";
import type { Item, ItemType, Priority } from "@/lib/domain/types";
import type { ItemInput } from "@/lib/domain/schemas";
import { localTiming } from "@/lib/domain/rules";
import { addMinutesToTime, formatDayLabel, formatTimeRange } from "@/lib/dates";
import { categoryName, categoryStyle, PRIORITY_DOT } from "@/lib/client/display";
import { useCategories, useCreateItems, useUpdateItem } from "@/lib/client/queries";
import { ApiError } from "@/lib/client/api";
import { useAppSettings } from "@/hooks/use-app-settings";
import { DatePickerSheet } from "@/components/pickers/date-picker-sheet";
import { TimePickerSheet } from "@/components/pickers/time-picker-sheet";
import { OptionSheet } from "@/components/pickers/option-sheet";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { tick } from "@/lib/haptics";
import { cn } from "@/lib/cn";

export interface FormState {
  title: string;
  notes: string;
  date: string | null;
  start: string | null;
  end: string | null;
  type: ItemType;
  priority: Priority;
  categoryId: string | null;
}

type Picker = "date" | "time" | "category" | "priority" | "notes" | null;

export function emptyForm(): FormState {
  return { title: "", notes: "", date: null, start: null, end: null, type: "task", priority: "medium", categoryId: null };
}

export function formFromItem(item: Item, tz: string): FormState {
  const lt = localTiming(item, tz);
  return {
    title: item.title,
    notes: item.notes ?? "",
    date: lt.date,
    start: lt.start_time,
    end: lt.end_time,
    type: item.type,
    priority: item.priority,
    categoryId: item.category_id,
  };
}

export function ItemForm({
  item,
  initial,
  openTimeOnMount,
  voiceSlot,
  titleSlot,
  onTitleChange,
}: {
  item?: Item;
  initial: FormState;
  openTimeOnMount?: boolean;
  /** milestone 4: voice button + typed-sentence parsing */
  voiceSlot?: (api: { setForm: (f: Partial<FormState>) => void; form: FormState }) => ReactNode;
  titleSlot?: (api: { setForm: (f: Partial<FormState>) => void; form: FormState }) => ReactNode;
  onTitleChange?: (title: string) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { locale, today, timeFormat, defaultEventMinutes } = useAppSettings();
  const categories = useCategories();
  const create = useCreateItems();
  const update = useUpdateItem();
  const [form, setFormState] = useState<FormState>(initial);
  const [picker, setPicker] = useState<Picker>(openTimeOnMount ? "time" : null);
  const [notesDraft, setNotesDraft] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const setForm = (f: Partial<FormState>) => setFormState((s) => ({ ...s, ...f }));

  const category = categories.find((c) => c.id === form.categoryId);
  const busy = create.isPending || update.isPending;
  const canSave = form.title.trim().length > 0 && (form.type === "task" || (form.date && form.start));

  function setType(type: ItemType) {
    if (type === "event" && !form.start) {
      setForm({ type, date: form.date ?? today });
      setPicker("time");
      return;
    }
    setForm({ type });
  }

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  async function submit() {
    if (!canSave || busy) return;
    setError(null);
    const input: ItemInput = {
      type: form.type,
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      date: form.date,
      start_time: form.type === "event" ? form.start : null,
      end_time: form.type === "event" ? form.end : null,
      priority: form.priority,
      category_id: form.categoryId,
      source: "manual",
    };
    try {
      if (item) {
        const { source: _s, ...patch } = input;
        await update.mutateAsync({ id: item.id, patch });
      } else {
        await create.mutateAsync([input]);
      }
      tick();
      toast({ message: t("state.saved"), duration: 2000 });
      close();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "network" ? t("error.offlineSave") : t("error.generic"));
    }
  }

  const priorityLabel = t(`priority.${form.priority}`);
  const dateLabel = form.date ? (form.date === today ? `${t("home.today")}, ${formatDayLabel(form.date, locale)}` : formatDayLabel(form.date, locale)) : t("field.none");
  const timeLabel = form.start ? formatTimeRange(form.start, form.end, locale, timeFormat) : t("field.noTime");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex min-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-48px)] flex-col lg:min-h-0"
    >
      <header className="chrome mb-5 grid grid-cols-[44px_1fr_44px] items-center">
        <button type="button" onClick={close} aria-label={t("newTask.back")} className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft className="size-6" aria-hidden />
        </button>
        <h1 className="text-center text-xl font-bold">{item ? t("newTask.editTitle") : t("newTask.title")}</h1>
      </header>

      <div className="relative">
        <label htmlFor="title" className="sr-only">
          {t("newTask.placeholder")}
        </label>
        <textarea
          id="title"
          name="title"
          rows={2}
          autoFocus={!item && !openTimeOnMount}
          value={form.title}
          placeholder={t("newTask.placeholder")}
          onChange={(e) => {
            setForm({ title: e.target.value });
            onTitleChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="block w-full resize-none rounded-[20px] border border-line bg-surface-2 px-4 py-4 pr-14 text-[17px] leading-snug placeholder:text-subtle focus:border-primary/40 focus:outline-none"
        />
        {titleSlot?.({ setForm, form })}
      </div>

      {/* Task | Event */}
      <div role="radiogroup" aria-label={t("field.type")} className="chrome mt-4 grid grid-cols-2 rounded-full bg-surface-2 p-1">
        {(["task", "event"] as const).map((ty) => (
          <button
            key={ty}
            type="button"
            role="radio"
            aria-checked={form.type === ty}
            onClick={() => setType(ty)}
            className={cn(
              "h-10 rounded-full text-[15px] font-semibold transition-colors duration-200",
              form.type === ty ? "bg-surface text-primary shadow-sm dark:bg-primary dark:text-white" : "text-muted",
            )}
          >
            {t(`type.${ty}`)}
          </button>
        ))}
      </div>

      <ul className="mt-4 divide-y divide-divider">
        <FieldRow icon={<CalendarDays />} label={t("field.date")} value={dateLabel} onClick={() => setPicker("date")} />
        <FieldRow icon={<Clock3 />} label={t("field.time")} value={timeLabel} onClick={() => setPicker("time")} />
        <FieldRow
          icon={<Folder />}
          label={t("field.category")}
          value={category ? categoryName(category, locale) : t("field.none")}
          onClick={() => setPicker("category")}
          dot={category ? categoryStyle(category.color).dot : undefined}
        />
        <FieldRow icon={<Flag />} label={t("field.priority")} value={priorityLabel} onClick={() => setPicker("priority")} dot={PRIORITY_DOT[form.priority]} />
        <FieldRow
          icon={<FileText />}
          label={t("field.notes")}
          value={form.notes || t("field.notesPlaceholder")}
          onClick={() => {
            setNotesDraft(form.notes);
            setPicker("notes");
          }}
        />
      </ul>

      <div className="mt-auto space-y-3 pt-6">
        {voiceSlot?.({ setForm, form })}
        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={!canSave || busy} data-testid="create-item">
          {item ? t("action.save") : t("action.create")}
        </Button>
      </div>

      <DatePickerSheet
        open={picker === "date"}
        onClose={() => setPicker(null)}
        value={form.date}
        today={today}
        locale={locale}
        allowNone={form.type === "task"}
        onChange={(date) => setForm({ date })}
      />
      <TimePickerSheet
        open={picker === "time"}
        onClose={() => {
          setPicker(null);
          // switched to Event but no time picked → back to Task
          setFormState((s) => (s.type === "event" && !s.start ? { ...s, type: "task" } : s));
        }}
        value={{ start: form.start, end: form.end }}
        defaultMinutes={defaultEventMinutes}
        onChange={({ start, end }) =>
          setForm(
            start
              ? { start, end: end ?? addMinutesToTime(start, defaultEventMinutes).time, type: "event", date: form.date ?? today }
              : { start: null, end: null, type: "task" },
          )
        }
      />
      <OptionSheet
        open={picker === "category"}
        onClose={() => setPicker(null)}
        title={t("field.category")}
        value={form.categoryId}
        onChange={(categoryId) => setForm({ categoryId })}
        options={[
          { value: null, label: t("field.none") },
          ...categories.map((c) => ({
            value: c.id,
            label: categoryName(c, locale),
            icon: <span aria-hidden className="size-3 rounded-full" style={{ background: categoryStyle(c.color).dot }} />,
          })),
        ]}
      />
      <OptionSheet<Priority>
        open={picker === "priority"}
        onClose={() => setPicker(null)}
        title={t("field.priority")}
        value={form.priority}
        onChange={(priority) => setForm({ priority })}
        options={(["high", "medium", "low"] as const).map((p) => ({
          value: p,
          label: t(`priority.${p}`),
          icon: <span aria-hidden className="size-3 rounded-full" style={{ background: PRIORITY_DOT[p] }} />,
        }))}
      />
      <Sheet
        open={picker === "notes"}
        onClose={() => setPicker(null)}
        title={t("field.notes")}
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setForm({ notes: notesDraft });
              setPicker(null);
            }}
          >
            {t("action.done")}
          </Button>
        }
      >
        <textarea
          aria-label={t("field.notes")}
          rows={6}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder={t("field.notesPlaceholder")}
          className="block w-full resize-none rounded-2xl border border-line bg-surface-2 p-4 leading-relaxed placeholder:text-subtle focus:outline-none"
        />
      </Sheet>
    </form>
  );
}

function FieldRow({ icon, label, value, onClick, dot }: { icon: ReactNode; label: string; value: string; onClick: () => void; dot?: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-[64px] w-full items-center gap-4 py-2 text-left">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-muted [&>svg]:size-[22px]">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium">{label}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
            {dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dot }} />}
            <span className="truncate">{value}</span>
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
      </button>
    </li>
  );
}
