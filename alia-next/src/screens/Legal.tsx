/* ───────────────────────────────────────────────────────────────────────────
   Legal — shared renderer for Alia's static legal documents.

   One component, two pages: pass the document's HTML (the static copy in
   legalContent.ts) plus a label and a back target. The
   body HTML is static, first-party legal text — rendered via dangerouslySet so
   the exact wording is preserved without re-typing pages of clauses. Full-screen
   scrollable doc on the app surface; light-mode aware via the shared tokens.
   ─────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { Icon } from './../icons';

export interface LegalProps {
  /** Verbatim doc-body HTML (from legalContent.ts). */
  html: string;
  /** Short uppercase label shown in the header (e.g. "Privacy"). */
  label: string;
  /** Where the back button goes. */
  backHref?: string;
  /** DOM id for the app-root (page hook). */
  id: string;
}

export default function Legal({ html, label, backHref = '/', id }: LegalProps) {
  return (
    <div className="app-root" id={id}>
      <div className="legal-head">
        <button className="legal-back" type="button" onClick={() => { window.location.href = backHref; }}>
          <Icon name="arrow" size={15} /> back
        </button>
        <span className="legal-label">{label}</span>
      </div>
      <div className="screen">
        <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
