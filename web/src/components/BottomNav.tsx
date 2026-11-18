import { NavLink } from 'react-router-dom';
import { Box, Indicator } from '@mantine/core';

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/guests', label: 'Guests', icon: '👥' },
  { to: '/budget', label: 'Budget', icon: '💰' },
];

// Tab bar along the bottom on phones and tablets (below the lg breakpoint). "More" opens the full menu drawer.
export function BottomNav({ onMore, moreActive, pending = 0 }: { onMore: () => void; moreActive?: boolean; pending?: number }) {
  return (
    <Box component="nav" className="bottom-nav app-chrome" hiddenFrom="lg" aria-label="Main">
      {TABS.map((t) => (
        // NavLink marks the current tab with aria-current="page", which the CSS styles.
        <NavLink key={t.to} to={t.to} end={t.end} className="bottom-nav-item">
          <span className="bottom-nav-icon" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </NavLink>
      ))}
      <button type="button" className="bottom-nav-item" onClick={onMore} data-active={moreActive || undefined} aria-label={pending > 0 ? `More, ${pending} new` : 'More'}>
        <Indicator disabled={pending === 0} size={8} color="rose" offset={2}>
          <span className="bottom-nav-icon" aria-hidden>
            ☰
          </span>
        </Indicator>
        More
      </button>
    </Box>
  );
}
