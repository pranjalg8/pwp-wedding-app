import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type RowSelectionOptions,
} from 'ag-grid-community';
import { ActionIcon, Badge, Button, Checkbox, Group, Menu, Stack, Text, useComputedColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { Guest } from './GuestEditor';
import type { RsvpDay } from './RsvpEditor';
import { INVITE_COLOR, INVITE_LABEL, splitOf, type Invite } from '../lib/rsvp';

// AG Grid Community only (MIT licence): sorting, filters, resizing, row selection and CSV export. Enterprise-only
// features (Excel export, range selection, clipboard, side panels) are deliberately not used.
ModuleRegistry.registerModules([AllCommunityModule]);

export type GuestRow = Guest & { _invites: Invite[] };

type GridContext = {
  days: RsvpDay[];
  onRsvp: (g: Guest) => void;
  onEdit: (g: Guest) => void;
  onDelete: (g: Guest) => void;
};

const rooms = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const roomsText = (g: Guest) => {
  const inside = Number(g.rooms_inside);
  const outside = Number(g.rooms_outside);
  return inside > 0 || outside > 0
    ? [inside > 0 ? `${rooms(inside)} in` : null, outside > 0 ? `${rooms(outside)} out` : null].filter(Boolean).join(' · ')
    : '—';
};

// A household's answer for each day it is invited to, in people: e.g. "Sun 14 Feb: 2 yes, 1 maybe".
function answersByDay(row: GuestRow, days: RsvpDay[]) {
  return days
    .map((d) => ({ d, inv: row._invites.find((i) => i.event_date === d.date) }))
    .filter((x): x is { d: RsvpDay; inv: Invite } => !!x.inv)
    .map(({ d, inv }) => ({ label: d.label, split: splitOf({ ...inv, guests: { persons: row.persons } }) }));
}

const PARTS = [
  ['coming', 'confirmed'],
  ['maybe', 'maybe'],
  ['declined', 'declined'],
  ['noReply', 'invited'],
] as const;

function rsvpText(row: GuestRow, days: RsvpDay[]) {
  if (row._invites.length === 0) return 'Not invited';
  return answersByDay(row, days)
    .map(({ label, split }) => `${label}: ${PARTS.filter(([k]) => split[k] > 0).map(([k, s]) => `${split[k]} ${INVITE_LABEL[s].toLowerCase()}`).join(', ')}`)
    .join(' | ');
}

// Two short lines that never wrap: the second is trimmed with an ellipsis (the full text is the tooltip).
const twoLines: React.CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0, lineHeight: 1.25 };

function HouseholdCell({ data }: ICellRendererParams<GuestRow>) {
  if (!data) return null;
  return (
    <div style={twoLines} title={[data.name, data.family_members].filter(Boolean).join(' · ')}>
      <Text fw={500} size="sm" truncate>
        {data.name}
      </Text>
      {data.family_members && (
        <Text size="xs" c="dimmed" truncate>
          {data.family_members}
        </Text>
      )}
    </div>
  );
}

function GroupCell({ data }: ICellRendererParams<GuestRow>) {
  if (!data) return null;
  return (
    <div style={twoLines} title={[data.list_group, data.relation].filter(Boolean).join(' · ')}>
      <Text size="sm" truncate>
        {data.list_group ?? '—'}
      </Text>
      {data.relation && (
        <Text size="xs" c="dimmed" truncate>
          {data.relation}
        </Text>
      )}
    </div>
  );
}

function RoomsCell({ data }: ICellRendererParams<GuestRow>) {
  if (!data) return null;
  const lines = [Number(data.rooms_inside) > 0 ? `${rooms(Number(data.rooms_inside))} in` : null, Number(data.rooms_outside) > 0 ? `${rooms(Number(data.rooms_outside))} out` : null].filter(Boolean);
  return (
    <div style={{ ...twoLines, alignItems: 'flex-end' }}>
      {lines.length === 0 ? (
        <Text size="sm" c="dimmed">
          —
        </Text>
      ) : (
        lines.map((l) => (
          <Text key={l} size="sm">
            {l}
          </Text>
        ))
      )}
    </div>
  );
}

function PriorityCell({ data }: ICellRendererParams<GuestRow>) {
  if (!data) return null;
  return data.priority ? (
    <Badge variant="light" color={data.priority === 1 ? 'rose' : 'gray'} tt="none">
      Priority {data.priority}
    </Badge>
  ) : (
    <Badge variant="outline" color="gray" tt="none">
      Not set
    </Badge>
  );
}

// Short labels so a day's answers fit on one line: "14 Feb  1 yes  2 maybe  1 no reply".
const SHORT: Record<(typeof PARTS)[number][1], string> = { confirmed: 'yes', maybe: 'maybe', declined: 'no', invited: 'no reply' };

function RsvpCell({ data, context }: ICellRendererParams<GuestRow, unknown, GridContext>) {
  if (!data) return null;
  if (data._invites.length === 0) {
    return (
      <div style={twoLines}>
        <Text size="xs" c="dimmed">
          Not invited
        </Text>
      </div>
    );
  }
  return (
    <div style={{ ...twoLines, gap: 3 }}>
      {answersByDay(data, context.days).map(({ label, split }) => (
        <Group key={label} gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', minWidth: 44 }}>
            {label.replace(/^\w+, /, '')}
          </Text>
          {PARTS.map(([k, status]) =>
            split[k] > 0 ? (
              <Badge key={k} size="sm" variant="light" color={INVITE_COLOR[status]} tt="none">
                {split[k]} {SHORT[status]}
              </Badge>
            ) : null
          )}
        </Group>
      ))}
    </div>
  );
}

// RSVP is the action used most, so it stays a button; Edit and Delete sit in a small menu to save width.
function ActionsCell({ data, context }: ICellRendererParams<GuestRow, unknown, GridContext>) {
  if (!data) return null;
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end" h="100%">
      <Button size="compact-xs" variant="light" onClick={() => context.onRsvp(data)}>
        RSVP
      </Button>
      <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="md" aria-label={`More actions for ${data.name}`}>
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
              ⋯
            </span>
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => context.onEdit(data)}>Edit household</Menu.Item>
          <Menu.Item color="red" onClick={() => context.onDelete(data)}>
            Delete household
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

// Must be one stable object: a new one on every render makes the grid reset which columns are shown.
const DEFAULT_COL_DEF: ColDef<GuestRow> = { sortable: true, resizable: true, floatingFilter: true, suppressHeaderMenuButton: true };

const roomsTotal = (g: Guest) => Number(g.rooms_inside) + Number(g.rooms_outside);

// The guest table: sort, filter, resize, pick columns, tick rows (edit mode) and export what you see as CSV.
export function GuestsGrid({
  rows,
  days,
  isUnlocked,
  onSelectionChange,
  onDisplayedChange,
  onReady,
  onRsvp,
  onEdit,
  onDelete,
}: {
  rows: GuestRow[];
  days: RsvpDay[];
  isUnlocked: boolean;
  onSelectionChange: (ids: string[]) => void;
  onDisplayedChange: (ids: string[]) => void;
  onReady: (api: GridApi<GuestRow>) => void;
  onRsvp: (g: Guest) => void;
  onEdit: (g: Guest) => void;
  onDelete: (g: Guest) => void;
}) {
  const scheme = useComputedColorScheme('light');
  // On a phone there is no room to pin the row actions or show every column, so keep the essentials.
  const narrow = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });
  const apiRef = useRef<GridApi<GuestRow> | null>(null);
  // Columns the user switched on or off in the Columns menu, by column id. Anything not listed keeps its default.
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  const theme = useMemo(
    () =>
      themeQuartz.withPart(scheme === 'dark' ? colorSchemeDark : colorSchemeLight).withParams({
        accentColor: '#c93a5e',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
        wrapperBorderRadius: 16,
        backgroundColor: scheme === 'dark' ? '#25262b' : '#ffffff',
        headerBackgroundColor: scheme === 'dark' ? '#2c2e33' : '#fbf6f1',
        rowHeight: 60,
        headerHeight: 44,
      }),
    [scheme]
  );

  const baseDefs = useMemo<ColDef<GuestRow>[]>(
    () => [
      { colId: 'name', headerName: 'Household', valueGetter: (p) => p.data?.name, cellRenderer: HouseholdCell, minWidth: 170, flex: 3, filter: 'agTextColumnFilter', filterValueGetter: (p) => `${p.data?.name ?? ''} ${p.data?.family_members ?? ''}` },
      { colId: 'family_members', headerName: 'Family members', valueGetter: (p) => p.data?.family_members ?? '', hide: true, filter: 'agTextColumnFilter' },
      { colId: 'group', headerName: 'Group', valueGetter: (p) => p.data?.list_group ?? '', hide: narrow, cellRenderer: GroupCell, minWidth: 100, flex: 2, filter: 'agTextColumnFilter', filterValueGetter: (p) => `${p.data?.list_group ?? ''} ${p.data?.relation ?? ''}` },
      { colId: 'relation', headerName: 'Relation', valueGetter: (p) => p.data?.relation ?? '', hide: true, filter: 'agTextColumnFilter' },
      { colId: 'where', headerName: 'Where', valueGetter: (p) => p.data?.location ?? '', valueFormatter: (p) => p.value || '—', hide: true, minWidth: 110, flex: 1, filter: 'agTextColumnFilter' },
      { colId: 'persons', headerName: 'People', field: 'persons', type: 'rightAligned', width: 90, filter: 'agNumberColumnFilter', cellStyle: { fontWeight: 600 } },
      {
        colId: 'rooms',
        headerName: 'Rooms',
        hide: narrow,
        valueGetter: (p) => (p.data ? roomsText(p.data) : ''),
        cellRenderer: RoomsCell,
        comparator: (_a, _b, nodeA, nodeB) => (nodeA.data ? roomsTotal(nodeA.data) : 0) - (nodeB.data ? roomsTotal(nodeB.data) : 0),
        type: 'rightAligned',
        width: 84,
        filter: 'agTextColumnFilter',
      },
      { colId: 'rooms_inside', headerName: 'Rooms inside', valueGetter: (p) => Number(p.data?.rooms_inside ?? 0), hide: true, type: 'rightAligned', filter: 'agNumberColumnFilter' },
      { colId: 'rooms_outside', headerName: 'Rooms outside', valueGetter: (p) => Number(p.data?.rooms_outside ?? 0), hide: true, type: 'rightAligned', filter: 'agNumberColumnFilter' },
      {
        colId: 'priority',
        headerName: 'Priority',
        valueGetter: (p) => (p.data?.priority ? `Priority ${p.data.priority}` : 'Not set'),
        cellRenderer: PriorityCell,
        width: 114,
        filter: 'agTextColumnFilter',
      },
      { colId: 'functions', headerName: 'Functions', valueGetter: (p) => p.data?.functions ?? '', valueFormatter: (p) => p.value || '—', hide: true, width: 120, filter: 'agTextColumnFilter' },
      {
        colId: 'rsvp',
        headerName: 'RSVP',
        valueGetter: (p) => (p.data ? rsvpText(p.data, days) : ''),
        cellRenderer: RsvpCell,
        minWidth: 285,
        flex: 3,
        filter: 'agTextColumnFilter',
      },
      ...(isUnlocked
        ? [
            {
              colId: 'actions',
              headerName: '',
              pinned: narrow ? undefined : ('right' as const),
              width: 112,
              sortable: false,
              filter: false,
              resizable: false,
              suppressMovable: true,
              cellRenderer: ActionsCell,
            } satisfies ColDef<GuestRow>,
          ]
        : []),
    ],
    [days, isUnlocked, narrow]
  );

  const columnDefs = useMemo<ColDef<GuestRow>[]>(
    () => baseDefs.map((d) => (d.colId && d.colId in visibility ? { ...d, hide: !visibility[d.colId] } : d)),
    [baseDefs, visibility]
  );
  const columnChoices = baseDefs
    .filter((d) => d.colId && d.colId !== 'actions')
    .map((d) => ({ id: d.colId as string, header: d.headerName ?? (d.colId as string), shown: visibility[d.colId as string] ?? !d.hide }));

  const rowSelection = useMemo<RowSelectionOptions | undefined>(
    () => (isUnlocked ? { mode: 'multiRow', checkboxes: true, headerCheckbox: true, selectAll: 'filtered', enableClickSelection: false } : undefined),
    [isUnlocked]
  );

  const context = useMemo<GridContext>(() => ({ days, onRsvp, onEdit, onDelete }), [days, onRsvp, onEdit, onDelete]);

  const reportDisplayed = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const ids: string[] = [];
    api.forEachNodeAfterFilter((n) => {
      if (n.data) ids.push(n.data.id);
    });
    onDisplayedChange(ids);
  }, [onDisplayedChange]);

  // Locking edit mode removes the tick boxes, so nothing stays selected.
  useEffect(() => {
    if (!isUnlocked) onSelectionChange([]);
  }, [isUnlocked, onSelectionChange]);

  function onGridReady(e: GridReadyEvent<GuestRow>) {
    apiRef.current = e.api;
    onReady(e.api);
    reportDisplayed();
  }

  function exportCsv() {
    const api = apiRef.current;
    if (!api) return;
    const columnKeys = api
      .getAllDisplayedColumns()
      .map((c) => c.getColId())
      .filter((id) => id !== 'actions' && !id.startsWith('ag-Grid'));
    api.exportDataAsCsv({ fileName: 'guests-table.csv', columnKeys });
  }

  function resetView() {
    const api = apiRef.current;
    if (!api) return;
    api.setFilterModel(null);
    api.applyColumnState({ defaultState: { sort: null } });
  }

  return (
    <Stack gap="xs">
      <Group justify="flex-end" gap="xs">
        <Group gap="xs">
          <Menu closeOnItemClick={false} position="bottom-end" shadow="md">
            <Menu.Target>
              <Button size="compact-sm" variant="default">
                Columns
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {columnChoices.map((c) => (
                <Menu.Item key={c.id} component="div">
                  <Checkbox
                    label={c.header}
                    checked={c.shown}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setVisibility((v) => ({ ...v, [c.id]: checked }));
                    }}
                  />
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Button size="compact-sm" variant="default" onClick={resetView}>
            Reset table
          </Button>
          <Button size="compact-sm" variant="default" onClick={exportCsv}>
            Export table (CSV)
          </Button>
        </Group>
      </Group>
      <div>
        <AgGridReact<GuestRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={(p) => p.data.id}
          rowSelection={rowSelection}
          context={context}
          domLayout="autoHeight"
          suppressCellFocus
          onGridReady={onGridReady}
          onModelUpdated={reportDisplayed}
          onSelectionChanged={(e) => onSelectionChange(e.api.getSelectedRows().map((r) => r.id))}
          overlayNoRowsTemplate="No households match."
        />
      </div>
    </Stack>
  );
}
