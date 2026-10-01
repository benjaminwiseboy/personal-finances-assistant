"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Date input showing JJ/MM/AAAA that you can type directly or pick from a
 * calendar popover. Talks ISO yyyy-mm-dd to the outside; emits "" while the
 * typed value is incomplete or impossible.
 */
export function DatePicker({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);

  const selected = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState<Date>(
    selected && isValid(selected) ? selected : new Date(),
  );

  // Re-sync when the ISO value changes from outside (reset, edit prefill).
  useEffect(() => {
    if ((displayToIso(display) ?? "") !== value) {
      setDisplay(isoToDisplay(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // When the calendar opens, jump it to the selected month.
  useEffect(() => {
    if (open && selected && isValid(selected)) setViewMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  function handleType(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let next = digits;
    if (digits.length > 4) {
      next = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      next = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setDisplay(next);
    onChange(displayToIso(next) ?? "");
  }

  function pick(day: Date) {
    const iso = format(day, "yyyy-MM-dd");
    setDisplay(isoToDisplay(iso));
    onChange(iso);
    setOpen(false);
  }

  const today = new Date();

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="JJ/MM/AAAA"
        value={display}
        onChange={(e) => handleType(e.target.value)}
        maxLength={10}
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Ouvrir le calendrier"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none"
            />
          }
        >
          <CalendarDays className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          {/* Month header */}
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-medium capitalize">
              {format(viewMonth, "MMMM yyyy", { locale: fr })}
            </span>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="py-1 text-center font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase"
              >
                {w}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5 px-0.5">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pick(day)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-sm transition-colors",
                    isSelected
                      ? "bg-gradient-to-b from-amber to-ember font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-foreground hover:bg-white/[0.08]"
                        : "text-muted-foreground/40 hover:bg-white/[0.05]",
                    !isSelected && isToday && "ring-1 ring-ember/50",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}
