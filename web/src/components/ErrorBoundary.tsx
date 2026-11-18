import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Paper, Stack, Text, Title } from '@mantine/core';
import { isChunkLoadError, reloadOnceForNewVersion } from '../lib/chunkReload';

type Props = {
  children: ReactNode;
  /** When this changes (e.g. the current path), a shown error is cleared and the children render again. */
  resetKey?: unknown;
};
type State = { error: unknown; resetKey: unknown };

// Shows a friendly card instead of a blank screen when a page crashes. If the crash is a page file that failed to
// load (a new version was deployed), it reloads once to pick up the new files.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnceForNewVersion()) return;
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error == null) return this.props.children;
    return (
      <Paper p="xl" maw={480} mx="auto" mt={60} ta="center">
        <Stack gap="sm" align="center">
          <Text fz={40} lh={1} aria-hidden>
            🥀
          </Text>
          <Title order={3}>Something went wrong</Title>
          <Text size="sm" c="dimmed">
            This page could not load. Reloading usually fixes it; nothing you saved is lost.
          </Text>
          <Button mt="xs" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Stack>
      </Paper>
    );
  }
}
