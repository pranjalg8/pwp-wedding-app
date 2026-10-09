import { HashRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import { AppShell, Badge, Burger, Button, Divider, Drawer, Group, Loader, Menu, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { supabase } from './lib/supabase';
import { EditModeProvider } from './components/EditModeProvider';
import { PinGateButton } from './components/PinGate';
import { DeviceNicknameModal } from './components/DeviceNickname';
import { getDeviceNickname } from './lib/device';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { TaskDetail } from './pages/TaskDetail';
import { TopicDetail } from './pages/TopicDetail';
import { Activity } from './pages/Activity';
import { Budget } from './pages/Budget';
import { Vendors } from './pages/Vendors';
import { Functions } from './pages/Functions';
import { FunctionResults } from './pages/FunctionResults';
import { Swipe } from './pages/Swipe';
import { HoneymoonItinerary } from './pages/HoneymoonItinerary';
import { Travel } from './pages/Travel';
import { HoneymoonLayout } from './components/HoneymoonLayout';
import { ActivityLayout } from './components/ActivityLayout';
import { Suggestions } from './pages/Suggestions';
import { usePendingSuggestions } from './hooks/usePendingSuggestions';

const NAV = [
  { to: '/', label: 'Tasks', end: true },
  { to: '/areas', label: 'Areas' },
  { to: '/budget', label: 'Budget' },
  { to: '/functions', label: 'Functions' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/honeymoon', label: 'Honeymoon' },
  { to: '/activity', label: 'Activity' },
];

function NavLinks({ onNavigate, vertical, pending = 0 }: { onNavigate?: () => void; vertical?: boolean; pending?: number }) {
  const Wrapper = vertical ? Stack : Group;
  return (
    <Wrapper gap={vertical ? 'xs' : 2} wrap={vertical ? undefined : 'nowrap'}>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <Button
              component="span"
              variant={isActive ? 'light' : 'subtle'}
              color={isActive ? 'rose' : 'gray'}
              size={vertical ? 'md' : 'sm'}
              px={vertical ? undefined : 10}
              fullWidth={vertical}
              justify={vertical ? 'flex-start' : 'center'}
              rightSection={n.to === '/activity' && pending > 0 ? <Badge size="xs" circle color="rose">{pending}</Badge> : undefined}
            >
              {n.label}
            </Button>
          )}
        </NavLink>
      ))}
    </Wrapper>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [drawerOpened, { toggle, close }] = useDisclosure(false);
  const [nameOpened, nameHandlers] = useDisclosure(false);
  const [nickname, setNickname] = useState(getDeviceNickname());
  const pending = usePendingSuggestions();

  return (
    <AppShell header={{ height: 60 }} padding={{ base: 'sm', sm: 'md', md: 'lg' }}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap" gap="md">
            <Burger opened={drawerOpened} onClick={toggle} hiddenFrom="lg" size="sm" aria-label="Menu" />
            <Title order={4} style={{ whiteSpace: 'nowrap' }}>
              <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                Pranjal <Text span c="rose.6">&amp;</Text> Paridhi
              </Link>
            </Title>
            <Group visibleFrom="lg" ml="md" wrap="nowrap">
              <NavLinks pending={pending} />
            </Group>
          </Group>
          <Group visibleFrom="lg" gap="xs" wrap="nowrap">
            <PinGateButton />
            <Menu position="bottom-end" width={220}>
              <Menu.Target>
                <Button variant="subtle" color="gray" size="sm" rightSection={<Text span size="xs">▾</Text>}>
                  {profile?.display_name}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{nickname ? `This device: ${nickname}` : 'This device is unnamed'}</Menu.Label>
                <Menu.Item onClick={nameHandlers.open}>{nickname ? 'Rename this device' : 'Name this device'}</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => supabase.auth.signOut()}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <Drawer opened={drawerOpened} onClose={close} size="xs" title={`Hi, ${profile?.display_name ?? ''}`} hiddenFrom="lg">
        <Stack>
          <NavLinks vertical onNavigate={close} pending={pending} />
          <Divider />
          <Stack gap="xs" align="stretch">
            <Button variant="subtle" color="gray" onClick={nameHandlers.open}>
              {nickname ? `Device: ${nickname}` : 'Name this device'}
            </Button>
            <PinGateButton />
          </Stack>
          <Divider />
          <Button variant="subtle" color="gray" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </Stack>
      </Drawer>

      <DeviceNicknameModal opened={nameOpened} onClose={nameHandlers.close} onSaved={setNickname} />

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

function AuthedApp() {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <Group justify="center" mt={100}>
        <Loader color="rose" />
      </Group>
    );
  }

  if (!profile) {
    return (
      <Group justify="center" mt={100} px="md">
        <Text ta="center">
          Your account isn't on the allowed list yet. Ask Pranjal to add your profile in Supabase.
        </Text>
      </Group>
    );
  }

  return (
    <EditModeProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Tasks />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
          <Route path="/areas" element={<Dashboard />} />
          <Route path="/topics/:topicKey" element={<TopicDetail />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/functions" element={<Functions />} />
          <Route path="/functions/swipe" element={<Swipe scope="wedding" />} />
          <Route path="/functions/results" element={<FunctionResults />} />
          <Route path="/honeymoon" element={<HoneymoonLayout />}>
            <Route index element={<HoneymoonItinerary />} />
            <Route path="travel" element={<Travel />} />
            <Route path="swipe" element={<Swipe />} />
          </Route>
          <Route path="/travel" element={<Navigate to="/honeymoon/travel" replace />} />
          <Route path="/swipe" element={<Navigate to="/honeymoon/swipe" replace />} />
          <Route path="/activity" element={<ActivityLayout />}>
            <Route index element={<Activity />} />
            <Route path="suggestions" element={<Suggestions />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Shell>
    </EditModeProvider>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <Group justify="center" mt={100}>
        <Loader color="rose" />
      </Group>
    );
  }

  return (
    <HashRouter>
      {session ? (
        <AuthedApp />
      ) : (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      )}
    </HashRouter>
  );
}
