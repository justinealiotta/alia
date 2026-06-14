/* ───────────────────────────────────────────────────────────────────────────
   AliaBottomNav — the room's hidden bottom navigation.
   No visible affordance: the transparent .nav-handle strip at the bottom is the
   tap target. Tapping reveals the bar (slides up, pushes the composer); tapping
   again — or anywhere outside — hides it. Buttons: profile avatar · discover
   (orbit) · Alia. Styling + slide transitions live in composer-styles.css.
   ─────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { Icon } from './icons';
import { MEMBER_IMGS } from './data';

export interface AliaBottomNavProps {
  open: boolean;
  onToggle: () => void;
  /** "You" avatar in the profile slot. */
  avatarSrc?: string;
  /** Which tab is the current page (rendered non-dimmed). Default 'alia'. */
  active?: 'profile' | 'discover' | 'alia';
  onProfile?: () => void;
  onDiscover?: () => void;
  onAlia?: () => void;
}

export default function AliaBottomNav({
  open,
  onToggle,
  avatarSrc = MEMBER_IMGS.JS,
  active = 'alia',
  onProfile,
  onDiscover,
  onAlia,
}: AliaBottomNavProps) {
  const dim = (tab: string) => (active === tab ? '' : ' dim');
  return (
    <>
      <div className={`nav-bar${open ? ' open' : ''}`} data-nav>
        <button className={`nav-btn${dim('profile')}`} aria-label="Profile" data-comment-anchor="nav-profile" onClick={onProfile}>
          <span className="nav-av">
            <img src={avatarSrc} alt="You" />
          </span>
        </button>
        <button className={`nav-btn${dim('discover')}`} aria-label="Discover" onClick={onDiscover}>
          <Icon name="orbit" size={28} />
        </button>
        <button className={`nav-btn${dim('alia')}`} aria-label="Alia" onClick={onAlia}>
          <span className="label">Alia</span>
        </button>
      </div>
      <button className="nav-handle" data-handle aria-label="Show navigation" onClick={onToggle} />
    </>
  );
}
