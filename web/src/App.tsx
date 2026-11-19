import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { AppShell, Badge, Box, Burger, Button, Divider, Drawer, Group, Loader, Menu, Paper, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { supabase } from './lib/supabase';
import { EditModeProvider } from './components/EditModeProvider';
import { PinGateButton, PinGateIcon } from './components/PinGate';
import { DeviceNicknameModal } from './components/DeviceNickname';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNav } from './components/BottomNav';
import { getDeviceNickname } from './lib/device';
import { reloadOnceForNewVersion } from './lib/chunkReload';
import { usePendingSuggestions } from './hooks/usePendingSuggestions';
import { useUnseenUpdates } from './hooks/useUpdates';

// Every page is its own file, loaded the first time it is opened, so the first screen arrives quickly.
type PageOf<M, K extends keyof M> = M[K] extends ComponentType<infer P> ? ComponentType<P> : never;

function lazyPage<M, K extends keyof M>(load: () => Promise<M>, name: K): LazyExoticComponent<PageOf<M, K>> {
  return lazy(async () => ({ default: (await load())[name] as PageOf<M, K> }));
}

const Login = lazyPage(() => import('./pages/Login'), 'Login');
const Home = lazyPage(() => import('./pages/Home'), 'Home');
const Dashboard = lazyPage(() => import('./pages/Dashboard'), 'Dashboard');
const Tasks = lazyPage(() => import('./pages/Tasks'), 'Tasks');
const TaskDetail = lazyPage(() => import('./pages/TaskDetail'), 'TaskDetail');
const TopicDetail = lazyPage(() => import('./pages/TopicDetail'), 'TopicDetail');
const Budget = lazyPage(() => import('./pages/Budget'), 'Budget');
const Vendors = lazyPage(() => import('./pages/Vendors'), 'Vendors');
const Knowledge = lazyPage(() => import('./pages/Knowledge'), 'Knowledge');
const Functions = lazyPage(() => import('./pages/Functions'), 'Functions');
const FunctionResults = lazyPage(() => import('./pages/FunctionResults'), 'FunctionResults');
const Swipe = lazyPage(() => import('./pages/Swipe'), 'Swipe');
const Guests = lazyPage(() => import('./pages/Guests'), 'Guests');
const HoneymoonLayout = lazyPage(() => import('./components/HoneymoonLayout'), 'HoneymoonLayout');
const HoneymoonItinerary = lazyPage(() => import('./pages/HoneymoonItinerary'), 'HoneymoonItinerary');
const Travel = lazyPage(() => import('./pages/Travel'), 'Travel');
const ActivityLayout = lazyPage(() => import('./components/ActivityLayout'), 'ActivityLayout');
const Activity = lazyPage(() => import('./pages/Activity'), 'Activity');
const Suggestions = lazyPage(() => import('./pages/Suggestions'), 'Suggestions');
const Updates = lazyPage(() => import('./pages/Updates'), 'Updates');
const ShareLinks = lazyPage(() => import('./pages/ShareLinks'), 'ShareLinks');
const SharedView = lazyPage(() => import('./pages/SharedView'), 'SharedView');
const Wishlist = lazyPage(() => import('./pages/Wishlist'), 'Wishlist');
const GiftWishlist = lazyPage(() => import('./pages/GiftWishlist'), 'GiftWishlist');
const AskKb = lazyPage(() => import('./components/AskKb'), 'AskKb');

// Vite reports a page file that failed to preload, usually because a new version was deployed while this tab was
// open. Reload once to pick up the new files (the guard in reloadOnceForNewVersion stops a reload loop).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});

const pageLoader = (
  <Group justify="center" mt={100}>
    <Loader color="rose" />
  </Group>
);

// Catches a crashed page; moving to another page clears the error.
function RouteBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

const NAV_GROUPS = [
  {
    label: 'Plan',
    items: [
      { to: '/', label: 'Home', icon: '🏠', end: true },
      { to: '/tasks', label: 'Tasks', icon: '✅' },
      { to: '/areas', label: 'Areas', icon: '🗂️' },
      { to: '/functions', label: 'Functions', icon: '🎉' },
      { to: '/guests', label: 'Guests', icon: '👥' },
    ],
  },
  {
    label: 'Money and people',
    items: [
      { to: '/budget', label: 'Budget', icon: '💰' },
      { to: '/vendors', label: 'Vendors', icon: '🤝' },
      { to: '/knowledge', label: 'Knowledge', icon: '📚' },
      { to: '/honeymoon', label: 'Honeymoon', icon: '🏝️' },
    ],
  },
  {
    label: 'Share and history',
    items: [
      { to: '/wishlist', label: 'Gift wishlist', icon: '🎁' },
      { to: '/share', label: 'Share', icon: '🔗' },
      { to: '/activity', label: 'Activity', icon: '🔔' },
    ],
  },
];

// Pages that have their own tab in the phone tab bar; anything else lights up "More".
const TAB_PATHS = ['/tasks', '/guests', '/budget'];

// The same grouped list is used in the desktop sidebar and in the phone drawer.
function NavLinks({ onNavigate, pending = 0 }: { onNavigate?: () => void; pending?: number }) {
  return (
    <Stack gap="md">
      {NAV_GROUPS.map((group) => (
        <Stack key={group.label} gap={4}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" px="sm" style={{ letterSpacing: 0.6 }}>
            {group.label}
          </Text>
          {group.items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <Button
                  component="span"
                  variant={isActive ? 'light' : 'subtle'}
                  color={isActive ? 'rose' : 'gray'}
                  size="md"
                  fullWidth
                  justify="flex-start"
                  fw={isActive ? 600 : 500}
                  style={isActive ? { boxShadow: 'inset 3px 0 0 var(--mantine-color-rose-6)' } : undefined}
                  leftSection={<span aria-hidden>{n.icon}</span>}
                  rightSection={n.to === '/activity' && pending > 0 ? <Badge size="sm" color="rose" variant="filled">{pending}</Badge> : undefined}
                >
                  {n.label}
                </Button>
              )}
            </NavLink>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [drawerOpened, { toggle, close }] = useDisclosure(false);
  const [nameOpened, nameHandlers] = useDisclosure(false);
  const [nickname, setNickname] = useState(getDeviceNickname());
  const pending = usePendingSuggestions() + useUnseenUpdates();
  const { pathname } = useLocation();
  const onTab = pathname === '/' || TAB_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 232, breakpoint: 'lg', collapsed: { mobile: true } }}
      padding={{ base: 'sm', sm: 'md', md: 'lg' }}
    >
      <AppShell.Header className="app-chrome">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap" gap="md">
            <Burger opened={drawerOpened} onClick={toggle} hiddenFrom="lg" size="sm" aria-label="Menu" />
            <Title order={4} style={{ whiteSpace: 'nowrap' }}>
              <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                Pranjal <Text span inherit c="rose.6">&amp;</Text> Paridhi
              </Link>
            </Title>
          </Group>
          <Box hiddenFrom="lg">
            <PinGateIcon />
          </Box>
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

      <AppShell.Navbar p="md" className="app-chrome" style={{ overflowY: 'auto' }}>
        <NavLinks pending={pending} />
      </AppShell.Navbar>

      <Drawer opened={drawerOpened} onClose={close} size="xs" title={`Hi, ${profile?.display_name ?? ''}`} hiddenFrom="lg">
        <Stack>
          <NavLinks onNavigate={close} pending={pending} />
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

      <AppShell.Main className="app-main">{children}</AppShell.Main>
      <BottomNav onMore={toggle} moreActive={drawerOpened || !onTab} pending={pending} />
      <Suspense fallback={null}>
        <AskKb />
      </Suspense>
    </AppShell>
  );
}

// Shown when someone signs in with an email that is not on the list.
function NotAllowed() {
  return (
    <Box className="hero brand-backdrop">
      <Paper p="xl" maw={420} w="100%" ta="center" shadow="lg">
        <Title order={2}>
          Pranjal <Text span inherit c="rose.6">&amp;</Text> Paridhi
        </Title>
        <div className="page-ornament" style={{ margin: '10px auto 0' }} aria-hidden />
        <Text mt="md">Your account isn't on the allowed list yet.</Text>
        <Text size="sm" c="dimmed" mt={4}>
          Ask Pranjal to add your profile in Supabase, then sign in again.
        </Text>
        <Button variant="subtle" color="gray" mt="lg" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </Paper>
    </Box>
  );
}

function AuthedApp() {
  const { profile, loading } = useProfile();

  if (loading) return pageLoader;
  if (!profile) return <NotAllowed />;

  return (
    <EditModeProvider>
      <Shell>
        <RouteBoundary>
          <Suspense fallback={pageLoader}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/:taskId" element={<TaskDetail />} />
              <Route path="/areas" element={<Dashboard />} />
              <Route path="/topics/:topicKey" element={<TopicDetail />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/share" element={<ShareLinks />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route path="/functions" element={<Functions />} />
              <Route path="/guests" element={<Guests />} />
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
                <Route path="updates" element={<Updates />} />
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </RouteBoundary>
      </Shell>
    </EditModeProvider>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  return (
    <HashRouter>
      <ErrorBoundary>
        <Suspense fallback={pageLoader}>
          <Routes>
            {/* Opened from a share link: no planner login, and it must not wait for one. */}
            <Route path="/s/:token" element={<SharedView />} />
            {/* The gift wishlist friends open from a link: public, no planner login. */}
            <Route path="/gifts" element={<GiftWishlist />} />
            <Route path="*" element={loading ? pageLoader : session ? <AuthedApp /> : <Login />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
