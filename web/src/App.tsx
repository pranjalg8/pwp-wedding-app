import { HashRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, Burger, Button, Divider, Drawer, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { supabase } from './lib/supabase';
import { EditModeProvider } from './components/EditModeProvider';
import { PinGateButton } from './components/PinGate';
import { DeviceNicknameButton } from './components/DeviceNickname';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TopicDetail } from './pages/TopicDetail';
import { Activity } from './pages/Activity';
import { Budget } from './pages/Budget';
import { Vendors } from './pages/Vendors';
import { Swipe } from './pages/Swipe';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/budget', label: 'Budget' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/swipe', label: 'Swipe' },
  { to: '/activity', label: 'Activity' },
];

function NavLinks({ onNavigate, vertical }: { onNavigate?: () => void; vertical?: boolean }) {
  const Wrapper = vertical ? Stack : Group;
  return (
    <Wrapper gap={vertical ? 'xs' : 4}>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <Button
              component="span"
              variant={isActive ? 'light' : 'subtle'}
              color={isActive ? 'rose' : 'gray'}
              size={vertical ? 'md' : 'sm'}
              fullWidth={vertical}
              justify={vertical ? 'flex-start' : 'center'}
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

  const actions = (
    <>
      <DeviceNicknameButton />
      <PinGateButton />
    </>
  );

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
            <Group visibleFrom="lg" ml="md">
              <NavLinks />
            </Group>
          </Group>
          <Group visibleFrom="lg" gap="xs" wrap="nowrap">
            {actions}
            <Text size="sm" c="dimmed">
              {profile?.display_name}
            </Text>
            <Button variant="subtle" color="gray" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <Drawer opened={drawerOpened} onClose={close} size="xs" title={`Hi, ${profile?.display_name ?? ''}`} hiddenFrom="lg">
        <Stack>
          <NavLinks vertical onNavigate={close} />
          <Divider />
          <Stack gap="xs" align="stretch">
            {actions}
          </Stack>
          <Divider />
          <Button variant="subtle" color="gray" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </Stack>
      </Drawer>

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/topics/:topicKey" element={<TopicDetail />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/swipe" element={<Swipe />} />
          <Route path="/activity" element={<Activity />} />
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
