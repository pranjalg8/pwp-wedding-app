import { Button, Group, Text } from '@mantine/core';

// The body of an "Undo" toast. The button never shrinks, so on a phone the text wraps instead of clipping it.
export function UndoMessage({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" align="center">
      <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
        {text}
      </Text>
      <Button size="compact-sm" variant="light" style={{ flexShrink: 0 }} onClick={onUndo}>
        Undo
      </Button>
    </Group>
  );
}
