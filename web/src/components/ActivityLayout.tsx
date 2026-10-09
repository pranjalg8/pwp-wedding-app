import { NavLink, Outlet } from 'react-router-dom';
import { Badge, Button, Group, Stack } from '@mantine/core';
import { usePendingSuggestions } from '../hooks/usePendingSuggestions';
import { useUnseenUpdates } from '../hooks/useUpdates';

export function ActivityLayout() {
  const pending = usePendingSuggestions();
  const unseen = useUnseenUpdates();
  const sections = [
    { to: '/activity/suggestions', label: 'Suggestions', end: false, count: pending },
    { to: '/activity/updates', label: "What's new", end: false, count: unseen },
    { to: '/activity', label: 'History', end: true, count: 0 },
  ];
  return (
    <Stack gap="md" maw={1120} mx="auto">
      <Group gap="xs" wrap="nowrap" style={{ overflowX: 'auto' }} pb={4}>
        {sections.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.end} style={{ textDecoration: 'none', flexShrink: 0 }}>
            {({ isActive }) => (
              <Button
                component="span"
                size="sm"
                variant={isActive ? 'filled' : 'light'}
                color={isActive ? 'rose' : 'gray'}
                rightSection={s.count > 0 ? <Badge size="xs" circle color={isActive ? 'dark' : 'rose'}>{s.count}</Badge> : undefined}
              >
                {s.label}
              </Button>
            )}
          </NavLink>
        ))}
      </Group>
      <Outlet />
    </Stack>
  );
}
