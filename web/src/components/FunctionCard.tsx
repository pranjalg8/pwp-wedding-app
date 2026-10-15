import { Link } from 'react-router-dom';
import { Badge, Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { OPTION_STATUS_LABEL, daysToDue } from '../lib/topicMeta';

export type WeddingFunction = {
  id: string;
  key: string;
  name: string;
  event_date: string;
  slot: 'first_half' | 'second_half';
  sort_order: number;
  theme: string | null;
  colours: string[];
  avoid_colours: string[];
  notes: string | null;
  status: 'open' | 'in_progress' | 'decided';
};

export const FUNCTION_STATUS_LABEL = { open: 'Open', in_progress: 'In progress', decided: 'Decided' } as const;
const STATUS_LEVEL = { open: 1, in_progress: 2, decided: 3 } as const;
const SLOT_LABEL = { first_half: 'First half', second_half: 'Second half' } as const;

// One soft tint per function so the cards are easy to tell apart at a glance.
const TINTS = ['rose', 'grape', 'blue', 'teal', 'orange', 'pink'];
export const tintFor = (index: number) => TINTS[index % TINTS.length];

// Groom outfit options are named after the function they are for (Tilak, Haldi, Varmala...).
const OUTFIT_OPTION_NAMES: Record<string, string[]> = {
  tilak: ['tilak'],
  sagai: ['sagai'],
  haldi: ['haldi'],
  shaadi: ['varmala', 'mandap'],
};

export type OutfitOption = { name: string; status: string };

function outfitLine(fn: WeddingFunction, options: OutfitOption[]) {
  const names = OUTFIT_OPTION_NAMES[fn.key];
  if (!names) return null;
  const mine = options.filter((o) => names.includes(o.name.toLowerCase()));
  if (mine.length === 0) return null;
  const chosen = mine.filter((o) => o.status === 'chosen').length;
  if (mine.length === 1) return `Groom outfit: ${OPTION_STATUS_LABEL[mine[0].status] ?? mine[0].status}`;
  return `Groom outfits: ${chosen} of ${mine.length} chosen`;
}

function StatusTrack({ status }: { status: WeddingFunction['status'] }) {
  const level = STATUS_LEVEL[status];
  return (
    <Box role="img" aria-label={`Status: ${FUNCTION_STATUS_LABEL[status]}`}>
      <Group gap={4} wrap="nowrap">
        {[1, 2, 3].map((n) => (
          <Box
            key={n}
            h={6}
            style={{
              flex: 1,
              borderRadius: 3,
              background: n <= level ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-gray-4)',
              opacity: n <= level ? 1 : 0.45,
            }}
          />
        ))}
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {FUNCTION_STATUS_LABEL[status]}
      </Text>
    </Box>
  );
}

export function FunctionCard({
  fn,
  tint,
  outfits = [],
  detailed = false,
  to,
  onEdit,
}: {
  fn: WeddingFunction;
  tint: string;
  outfits?: OutfitOption[];
  detailed?: boolean;
  to?: string;
  onEdit?: () => void;
}) {
  const date = new Date(fn.event_date + 'T00:00:00');
  const d = daysToDue(fn.event_date);
  const countdown = d < 0 ? 'Past' : d === 0 ? 'Today' : `in ${d} d`;
  const outfit = outfitLine(fn, outfits);

  const body = (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" align="center">
          <Box
            ta="center"
            px="sm"
            py={6}
            style={{ borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-body)', minWidth: 52 }}
          >
            <Text fz={22} fw={700} lh={1}>
              {date.getDate()}
            </Text>
            <Text size="xs" tt="uppercase" c="dimmed">
              {date.toLocaleDateString('en-IN', { month: 'short' })}
            </Text>
          </Box>
          <div style={{ minWidth: 0 }}>
            <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
              {fn.name}
            </Text>
            <Text size="xs" c="dimmed">
              {SLOT_LABEL[fn.slot]}
            </Text>
          </div>
        </Group>
        <Badge variant="white" color={d <= 14 && d >= 0 ? 'orange' : 'gray'} style={{ flexShrink: 0 }}>
          {countdown}
        </Badge>
      </Group>

      <StatusTrack status={fn.status} />

      {fn.theme ? (
        <Text size="sm">{fn.theme}</Text>
      ) : (
        <Text size="sm" c="dimmed">
          Theme not decided yet
        </Text>
      )}
      {outfit && (
        <Text size="xs" c="dimmed">
          {outfit}
        </Text>
      )}

      {detailed && (fn.colours.length > 0 || fn.avoid_colours.length > 0) && (
        <Group gap={6}>
          {fn.colours.map((c) => (
            <Badge key={c} color="teal" variant="light">
              {c}
            </Badge>
          ))}
          {fn.avoid_colours.map((c) => (
            <Badge key={c} color="red" variant="light">
              avoid {c}
            </Badge>
          ))}
        </Group>
      )}
      {detailed && fn.notes && (
        <Text size="sm" c="dimmed">
          {fn.notes}
        </Text>
      )}
      {onEdit && (
        <Group justify="flex-end">
          <Button variant="white" size="compact-sm" onClick={onEdit}>
            Edit
          </Button>
        </Group>
      )}
    </Stack>
  );

  const style = { background: `var(--mantine-color-${tint}-light)`, border: 'none' } as const;
  return to ? (
    <Paper component={Link} to={to} p="md" className="topic-card" style={{ ...style, textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {body}
    </Paper>
  ) : (
    <Paper p="md" style={style}>
      {body}
    </Paper>
  );
}
