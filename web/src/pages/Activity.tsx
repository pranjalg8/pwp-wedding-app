import { useEffect, useState } from 'react';
import { Badge, Table, Tabs, Text, Title } from '@mantine/core';
import { supabase, type AuditEntry } from '../lib/supabase';

function AuditTable({ entries, kind }: { entries: AuditEntry[]; kind: 'manual' | 'sync' }) {
  return (
    <Table.ScrollContainer minWidth={520} mt="md">
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>When</Table.Th>
          <Table.Th>{kind === 'manual' ? 'Who' : 'Source'}</Table.Th>
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
                  {(e.device_info?.nickname as string) || (e.device_info?.platform as string) || '—'}
                </Text>
              </Table.Td>
            )}
          </Table.Tr>
        ))}
        {entries.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={kind === 'manual' ? 5 : 4}>
              <Text c="dimmed">No entries yet.</Text>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
    </Table.ScrollContainer>
  );
}

export function Activity() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setEntries(data ?? []));
  }, []);

  const manual = entries.filter((e) => e.actor_type === 'manual');
  const sync = entries.filter((e) => e.actor_type === 'sync');

  return (
    <>
      <Title order={2} mb="lg">
        Activity
      </Title>
      <Tabs defaultValue="manual">
        <Tabs.List>
          <Tabs.Tab value="manual">Manual changes ({manual.length})</Tabs.Tab>
          <Tabs.Tab value="sync">Automatic / Sync changes ({sync.length})</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="manual">
          <AuditTable entries={manual} kind="manual" />
        </Tabs.Panel>
        <Tabs.Panel value="sync">
          <AuditTable entries={sync} kind="sync" />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
