/* ───────────────────────────────────────────────────────────────────────────
   AliaField — a self-formatting inline text field (one editable line).

   The canonical field block, standardised on the Referral/Casting treatment:
   the line is already styled, the placeholder sits at the SAME size/font as the
   value (via `.editable.empty::before { content: attr(data-ph) }` in CSS), and
   it reformats IN PLACE on blur. Uncontrolled contentEditable seeded once on
   mount, committed to state/`onChange` on blur.

   Same block, two data sources:
     • Apply    → starts empty (you enter new data)
     • Casting / Referral-Flow → starts pre-filled from Supabase (you edit)

   `className` carries the host's type scale (`.cast-seed-name`, `.mmi-field-name`,
   `.cast-seed-line`, …); `format` optionally normalises the raw text on blur
   (bday → age, handle → @handle, …).
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useRef, useState, useEffect } from 'react';

export interface AliaFieldProps {
  className?: string;
  /** Stable block id — the field's canonical key (FieldKey), also the Supabase
   *  column this field maps to. Stamped as data-field-id so any container can
   *  read a field's identity off the DOM (commit / autosave) without scraping
   *  the placeholder text. */
  id?: string;
  initial?: string;
  placeholder?: string;
  locked?: boolean;
  autoFocus?: boolean;
  format?: (raw: string) => string;
  /** fires on each keystroke with the current text (for live/idle handling) */
  onType?: (value: string) => void;
  onChange?: (value: string) => void;
}

export default function AliaField({ className = '', id, initial = '', placeholder = '', locked = false, autoFocus = false, format, onType, onChange }: AliaFieldProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [empty, setEmpty] = useState(!initial);

  // seed the line once on mount (uncontrolled thereafter); optionally autofocus
  useEffect(() => {
    if (ref.current) ref.current.textContent = initial;
    setEmpty(!initial.trim());
    if (autoFocus) ref.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onInput = () => { setEmpty(!ref.current?.textContent?.trim()); onType?.(ref.current?.textContent || ''); };
  const onBlur = () => {
    if (!ref.current) return;
    let v = ref.current.textContent || '';
    if (format) { v = format(v); ref.current.textContent = v; }
    setEmpty(!v.trim());
    onChange?.(v.trim());
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLElement).blur(); }
  };

  return (
    <div
      ref={ref}
      className={className + ' editable' + (empty ? ' empty' : '') + (locked ? ' frozen' : '')}
      contentEditable={!locked}
      suppressContentEditableWarning
      spellCheck={false}
      data-block-id={id}
      data-ph={placeholder}
      onInput={onInput}
      onBlur={onBlur}
      onKeyDown={onKey}
    ></div>
  );
}
