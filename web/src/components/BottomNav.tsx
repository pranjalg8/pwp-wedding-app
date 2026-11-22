import { NavLink } from 'react-router-dom';
import { Box, Indicator } from '@mantine/core';

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/guests', label: 'Guests', icon: '👥' },
  { to: '/budget', label: 'Budget', icon: '💰' },
];

// Tab bar along the bottom on phones and tablets (below the lg breakpoint). "More" opens the full menu drawer.
export function BottomNav({
  onMore,
  moreActive,
  pending = 0,
  showFeed = false,
}: {
  onMore: () => void;
  moreActive?: boolean;
  pending?: number;
  showFeed?: boolean;
}) {
  // My feed takes the Guests slot for whoever has it; Guests stays in the More drawer.
  const tabs = showFeed ? [TABS[0], { to: '/feed', label: 'Feed', icon: '⚡' }, ...TABS.filter((t) => t.to !== '/' && t.to !== '/guests')] : TABS;
  return (
    <Box component="nav" className="bottom-nav app-chrome" hiddenFrom="lg" aria-label="Main">
      {tabs.map((t) => (
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
