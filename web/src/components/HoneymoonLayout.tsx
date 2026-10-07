import { NavLink, Outlet } from 'react-router-dom';
import { Button, Group, Stack } from '@mantine/core';
import { DestinationBar } from './DestinationBar';

const SECTIONS = [
  { to: '/honeymoon', label: 'Itinerary', end: true },
  { to: '/honeymoon/travel', label: 'Getting there' },
  { to: '/honeymoon/swipe', label: 'Swipe' },
];

export function HoneymoonLayout() {
  return (
    <Stack gap="md" maw={1120} mx="auto">
      <Group gap="xs" wrap="nowrap" style={{ overflowX: 'auto' }} pb={4}>
        {SECTIONS.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.end} style={{ textDecoration: 'none', flexShrink: 0 }}>
            {({ isActive }) => (
              <Button component="span" size="sm" variant={isActive ? 'filled' : 'light'} color={isActive ? 'rose' : 'gray'}>
                {s.label}
              </Button>
            )}
          </NavLink>
        ))}
      </Group>
      <DestinationBar />
      <Outlet />
    </Stack>
  );
}
