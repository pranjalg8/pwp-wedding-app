import { ActionIcon, Box, Group, Text } from '@mantine/core';

// A big − n + stepper for small whole-number counts (people coming, and so on). Both buttons are 44px,
// so it is easy to use with a thumb. Adapted from the count rows in RsvpEditor.
export function CountStepper({
  label,
  hint,
  color = 'rose',
  value,
  min = 0,
  max,
  canAdd = true,
  disabled = false,
  context,
  onChange,
}: {
  label: string;
  hint?: string;
  color?: string;
  value: number;
  min?: number;
  // Upper bound for this one count. Use canAdd when the cap is shared between several steppers.
  max?: number;
  canAdd?: boolean;
  disabled?: boolean;
  // Read out with the buttons, e.g. "Sun 14 Feb", so "One more yes for Sun 14 Feb".
  context?: string;
  onChange: (v: number) => void;
}) {
  const forWhat = context ? ` for ${context}` : '';
  const addOk = canAdd && (max === undefined || value < max);
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
        <Box w={10} h={10} style={{ borderRadius: '50%', flexShrink: 0, background: `var(--mantine-color-${color}-6)` }} />
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={700} lh={1.2}>
            {label}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" lh={1.2}>
              {hint}
            </Text>
          )}
        </div>
      </Group>
      <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
        <ActionIcon
          variant="light"
          color={color}
          size={44}
          radius="xl"
          aria-label={`One fewer ${label.toLowerCase()}${forWhat}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
        >
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
            −
          </span>
        </ActionIcon>
        <Text w={32} ta="center" fw={700} fz={22} aria-live="polite" aria-label={`${label}: ${value}`}>
          {value}
        </Text>
        <ActionIcon
          variant="light"
          color={color}
          size={44}
          radius="xl"
          aria-label={`One more ${label.toLowerCase()}${forWhat}`}
          disabled={disabled || !addOk}
          onClick={() => onChange(value + 1)}
        >
          <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
            +
          </span>
        </ActionIcon>
      </Group>
    </Group>
  );
}
