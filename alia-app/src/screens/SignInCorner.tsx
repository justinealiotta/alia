/* ───────────────────────────────────────────────────────────────────────────
   SignInCorner — the top-right session widget on the landing.

   States (persisted to localStorage as `alia.session`):
     • in          — logged in. Persistent, like IG. Just your avatar.
     • recognized  — you signed yourself out, but the device still knows you.
                     Avatar sits over "log in". One click reconnects the token
                     (no code).
     • flagged     — the session was killed by a security event. Same avatar +
                     "log in", but the click can't trust the token: it emails a
                     code and the "log in" word becomes an oversized paste-spot
                     for the 6 digits.

   The avatar menu (tap avatar while logged in) is the demo switch: sign out
   → recognized, sign out (security flag) → flagged.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React from 'react';
import { img } from './../data';

const ME = img('alia front-facing face selfie.png');

type State = 'in' | 'recognized' | 'flagged' | 'reconnecting' | 'otp';

export default function SignInCorner() {
  const [state, setState] = React.useState<State>(() => {
    const s = typeof localStorage !== 'undefined' ? localStorage.getItem('alia.session') : null;
    return s === 'recognized' || s === 'flagged' ? (s as State) : 'in';
  });
  const [menu, setMenu] = React.useState(false);
  const [code, setCode] = React.useState('');
  const codeRef = React.useRef<HTMLInputElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const persist = (s: 'in' | 'recognized' | 'flagged') => {
    try { localStorage.setItem('alia.session', s); } catch {}
  };

  const goIn = () => { setState('in'); persist('in'); setMenu(false); setCode(''); };

  /* Avatar menu — the demo switch for the two signed-out variants. */
  const signOut = () => { setState('recognized'); persist('recognized'); setMenu(false); };
  const flag    = () => { setState('flagged');    persist('flagged');    setMenu(false); };

  /* "log in" click. Recognized → one-click reconnect. Flagged → email + code. */
  const clickLogin = () => {
    if (state === 'flagged') {
      setState('otp');
      requestAnimationFrame(() => codeRef.current?.focus());
    } else {
      setState('reconnecting');
      window.setTimeout(goIn, 480);
    }
  };

  const onCode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(v);
    if (v.length === 6) window.setTimeout(goIn, 420);
  };

  /* Dismiss the account menu on outside click / Esc. */
  React.useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const avatar = (
    <img
      className="avatar"
      src={ME}
      alt="you"
      onClick={() => { if (state === 'in') setMenu((m) => !m); }}
      style={{ cursor: state === 'in' ? 'pointer' : 'default' }}
    />
  );

  return (
    <div className="session-corner" ref={wrapRef} data-state={state}>
      {state === 'otp' ? (
        <div className="otp-spot">
          <span className="otp-note">code sent to your email</span>
          <input
            ref={codeRef}
            className="otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            size={6}
            value={code}
            onChange={onCode}
            aria-label="6-digit code"
          />
        </div>
      ) : (
        <>
          {state === 'recognized' || state === 'flagged' ? (
            <button className="login" type="button" onClick={clickLogin}>log in</button>
          ) : null}
          {avatar}
          {menu ? (
            <div className="acct-menu">
              <button type="button" onClick={signOut}>log out</button>
              <button type="button" className="dim" onClick={flag}>log out (security flag)</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
