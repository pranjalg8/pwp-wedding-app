import { useEffect, useState } from 'react';
import { Badge, Box, Table, Tabs, Text } from '@mantine/core';
import { EmptyState } from '../components/EmptyState';
import { PageSkeleton } from '../components/PageSkeleton';
import { PageHeader } from '../components/PageHeader';
import { supabase, type AuditEntry } from '../lib/supabase';
import { describeDevice } from '../lib/device';

function AuditTable({ entries, kind }: { entries: AuditEntry[]; kind: 'manual' | 'sync' | 'link' }) {
  if (entries.length === 0) {
    return (
      <Box mt="md">
        <EmptyState
          compact
          emoji="📜"
          title="Nothing logged yet"
          hint={kind === 'link' ? 'Changes made through a shared link will show up here.' : 'Changes will show up here as they happen.'}
        />
      </Box>
    );
  }
  return (
    <Table.ScrollContainer minWidth={520} mt="md">
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>When</Table.Th>
          <Table.Th>{kind === 'manual' ? 'Who' : kind === 'link' ? 'Link' : 'Source'}</Table.Th>
          <Table.Th>Table</Table.Th>
          <Table.Th>Action</Table.Th>
          {kind === 'manual' && <Table.Th>Device</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entries.map((e) => (
          <Table.Tr key={e.id}>
            <Table.Td>{new Date(e.created_at).toLocaleString()}</Table.Td>
            <Table.Td>{e.actor_name}</Table.Td>
            <Table.Td>{e.table_name}</Table.Td>
            <Table.Td>
              <Badge variant="light">{e.action}</Badge>
            </Table.Td>
            {kind === 'manual' && (
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {[e.device_info?.nickname as string, describeDevice(e.device_info?.user_agent as string)]
                    .filter(Boolean)
                    .join(' — ') || '—'}
                </Text>
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    </Table.ScrollContainer>
  );
}

export function Activity() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoaded(true);
      });
  }, []);

  const manual = entries.filter((e) => e.actor_type === 'manual');
  const sync = entries.filter((e) => e.actor_type === 'sync');
  const viaLink = entries.filter((e) => e.actor_type === 'link');

  return (
    <>
      <PageHeader title="Activity" mb="lg" />
      {!loaded ? (
        <PageSkeleton cards={3} />
      ) : (
      <Tabs defaultValue="manual">
        <Tabs.List>
          <Tabs.Tab value="manual">Manual changes ({manual.length})</Tabs.Tab>
          <Tabs.Tab value="sync">Automatic / Sync changes ({sync.length})</Tabs.Tab>
          <Tabs.Tab value="link">Shared links ({viaLink.length})</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="manual">
          <AuditTable entries={manual} kind="manual" />
        </Tabs.Panel>
        <Tabs.Panel value="sync">
          <AuditTable entries={sync} kind="sync" />
        </Tabs.Panel>
        <Tabs.Panel value="link">
          <AuditTable entries={viaLink} kind="link" />
        </Tabs.Panel>
      </Tabs>
      )}
    </>
  );
}
