/* ───────────────────────────────────────────────────────────────────────────
   Legal — shared renderer for Alia's static legal documents (Terms, Privacy).

   One component, two pages: pass the document's verbatim HTML (from
   legalContent.ts) plus a DOM id. No header, no back button, no chrome — just
   the doc on the black app surface, styled app-native (lowercase, big white
   headers, big faded numbers) via styles/legal.css. Left-aligned; the type
   scales up with the viewport. The body HTML is static first-party legal text,
   rendered via dangerouslySet so the exact wording is preserved.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React from 'react';

export interface LegalProps {
  /** Verbatim doc-body HTML (from legalContent.ts). */
  html: string;
  /** DOM id for the flow-root (page hook: "terms" | "privacy"). */
  id: string;
}

export default function Legal({ html, id }: LegalProps) {
  return (
    <div className="flow-root legal" id={id}>
      <div className="legal-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
