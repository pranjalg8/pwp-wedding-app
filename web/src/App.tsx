import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, Button, Group, Loader, Text, Title } from '@mantine/core';
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

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={4}>
              <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                PwP Wedding Planner
              </Link>
            </Title>
            <Button component={Link} to="/budget" variant="subtle" size="sm">
              Budget
            </Button>
            <Button component={Link} to="/vendors" variant="subtle" size="sm">
              Vendors
            </Button>
            <Button component={Link} to="/activity" variant="subtle" size="sm">
              Activity
            </Button>
          </Group>
          <Group>
            <DeviceNicknameButton />
            <PinGateButton />
            <Text size="sm" c="dimmed">
              {profile?.display_name}
            </Text>
            <Button variant="subtle" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

function AuthedApp() {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <Group justify="center" mt={100}>
        <Loader />
      </Group>
    );
  }

  if (!profile) {
    return (
      <Group justify="center" mt={100}>
        <Text>
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
        <Loader />
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
