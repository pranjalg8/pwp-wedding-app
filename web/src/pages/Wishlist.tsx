import { useMemo, useState } from 'react';
import { ActionIcon, Anchor, Badge, Button, Card, CopyButton, Group, Image, SegmentedControl, SimpleGrid, Stack, Switch, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRealtime } from '../hooks/useRealtime';
import { useEditMode } from '../hooks/useEditMode';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { EditButton } from '../components/EditButton';
import { LoadError, PageSkeleton } from '../components/PageSkeleton';
import { WishlistEditor } from '../components/WishlistEditor';
import { confirmDanger } from '../lib/confirm';
import { supabase } from '../lib/supabase';
import { formatPrice, storeOf, wishlistUrl, type WishClaim, type WishItem } from '../lib/wishlist';

// Manage the gift wishlist: what we need for the new home. Friends see the same list on the public page
// (#/gifts) once it is switched on, and mark what they will gift. The names of who took what are only shown here.
export function Wishlist() {
  const { requestUnlock } = useEditMode();
  const [items, setItems] = useState<WishItem[]>([]);
  const [claims, setClaims] = useState<WishClaim[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<WishItem | 'new' | null>(null);
  const [filter, setFilter] = useState('all');

  async function load() {
    const [i, c, s] = await Promise.all([
      supabase.from('wishlist_items').select('*').order('sort_order').order('created_at'),
      supabase.from('wishlist_claims').select('id, item_id, name, created_at').order('created_at'),
      supabase.from('wishlist_settings').select('open').maybeSingle(),
    ]);
    const err = i.error ?? c.error ?? s.error;
    setLoadError(err?.message ?? null);
    if (err) return;
    setItems((i.data ?? []) as WishItem[]);
    setClaims((c.data ?? []) as WishClaim[]);
    setOpen(!!s.data?.open);
    setLoaded(true);
  }
  useRealtime(['wishlist_items', 'wishlist_claims', 'wishlist_settings'], load, { immediate: true });

  const takenBy = useMemo(() => {
    const m = new Map<string, WishClaim[]>();
    for (const c of claims) m.set(c.item_id, [...(m.get(c.item_id) ?? []), c]);
    return m;
  }, [claims]);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const shown = filter === 'all' ? items : items.filter((i) => i.category === filter);

  const totals = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const i of items) {
      lo += (i.price_min ?? i.price_max ?? 0) * i.quantity;
      hi += (i.price_max ?? i.price_min ?? 0) * i.quantity;
    }
    return { lo, hi, taken: claims.length, wanted: items.reduce((n, i) => n + i.quantity, 0) };
  }, [items, claims]);

  function toggleOpen(next: boolean) {
    requestUnlock(async () => {
      const { error } = await supabase.from('wishlist_settings').update({ open: next }).eq('id', true);
      if (error) notifications.show({ color: 'red', message: `Could not change that: ${error.message}` });
      else setOpen(next);
    });
  }

  function toggleHidden(item: WishItem) {
    requestUnlock(async () => {
      const { error } = await supabase.from('wishlist_items').update({ hidden: !item.hidden }).eq('id', item.id);
      if (error) notifications.show({ color: 'red', message: error.message });
    });
  }

  function remove(item: WishItem) {
    requestUnlock(async () => {
      const taken = takenBy.get(item.id)?.length ?? 0;
      const ok = await confirmDanger({
        title: 'Delete this gift?',
        message: `"${item.title}" will be removed for good${taken ? `, along with ${taken === 1 ? 'the claim' : `the ${taken} claims`} on it` : ''}. To keep it but stop friends seeing it, hide it instead.`,
        confirmLabel: 'Delete gift',
      });
      if (!ok) return;
      const { error } = await supabase.from('wishlist_items').delete().eq('id', item.id);
      if (error) notifications.show({ color: 'red', message: error.message });
    });
  }

  function removeClaim(c: WishClaim) {
    requestUnlock(async () => {
      const ok = await confirmDanger({ title: 'Free this gift up?', message: `${c.name} will no longer be shown as giving this, and someone else can take it.`, confirmLabel: 'Free it up' });
      if (!ok) return;
      const { error } = await supabase.from('wishlist_claims').delete().eq('id', c.id);
      if (error) notifications.show({ color: 'red', message: error.message });
    });
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Gift wishlist"
        icon="🎁"
        subtitle="What we need for the new home. Friends see the same list and can mark what they will gift, so nothing is bought twice."
        action={
          <EditButton onClick={() => setEditing('new')} leftSection={<span aria-hidden>＋</span>}>
            Add a gift
          </EditButton>
        }
      />

      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          <Switch
            checked={open}
            onChange={(e) => toggleOpen(e.currentTarget.checked)}
            label="Friends can see the list"
            description={open ? 'Anyone with the link can see it. They cannot see anything else in the planner.' : 'Switched off: the link shows "not open yet". Turn it on when you are ready to share.'}
          />
          <Group gap="xs" wrap="wrap">
            <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>{wishlistUrl()}</Text>
            <CopyButton value={wishlistUrl()}>
              {({ copied, copy }) => (
                <Button size="compact-xs" variant="light" onClick={copy}>
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              )}
            </CopyButton>
            <Anchor size="xs" href={wishlistUrl()} target="_blank" rel="noopener noreferrer">
              See what friends see
            </Anchor>
          </Group>
        </Stack>
      </Card>

      {loadError && <LoadError message={loadError} onRetry={() => void load()} />}
      {!loaded && !loadError && <PageSkeleton cards={3} />}

      {loaded && items.length > 0 && (
        <>
          <Group gap="xl" wrap="wrap">
            <Stat label="Gifts wanted" value={String(totals.wanted)} />
            <Stat label="Already taken" value={`${totals.taken} of ${totals.wanted}`} />
            <Stat label="Whole list" value={totals.hi ? (totals.lo === totals.hi ? formatPrice(totals.lo, totals.lo) : formatPrice(totals.lo, totals.hi)) : '—'} />
          </Group>
          {categories.length > 1 && (
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              data={[{ value: 'all', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]}
              style={{ overflowX: 'auto', maxWidth: '100%' }}
            />
          )}
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="md">
            {shown.map((item) => {
              const who = takenBy.get(item.id) ?? [];
              const store = storeOf(item.url);
              return (
                <Card key={item.id} withBorder radius="md" p={0} style={{ opacity: item.hidden ? 0.65 : 1 }}>
                  {item.image_url ? (
                    <Image src={item.image_url} alt="" h={170} fit="contain" fallbackSrc="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/%3E" />
                  ) : (
                    <Group h={110} justify="center" bg="var(--mantine-color-gray-light)">
                      <Text fz={36} aria-hidden>🎁</Text>
                    </Group>
                  )}
                  <Stack gap={6} p="md">
                    <Group gap={6} wrap="wrap">
                      <Badge variant="light" color="gray">{item.category}</Badge>
                      {store && <Badge variant="outline" color="gray">{store}</Badge>}
                      {item.hidden && <Badge color="orange" variant="light">Hidden from friends</Badge>}
                    </Group>
                    <Text fw={600} lh={1.3}>{item.title}</Text>
                    {formatPrice(item.price_min, item.price_max) && <Text size="sm" fw={500}>{formatPrice(item.price_min, item.price_max)}</Text>}
                    {item.quantity > 1 && <Text size="xs" c="dimmed">We need {item.quantity}</Text>}
                    {item.note && <Text size="sm" c="dimmed">{item.note}</Text>}
                    {who.length > 0 ? (
                      <Stack gap={2}>
                        {who.map((c) => (
                          <Group key={c.id} gap={6} wrap="nowrap">
                            <Badge color="teal" variant="light" style={{ flexShrink: 0 }}>Taken</Badge>
                            <Text size="sm" style={{ overflowWrap: 'anywhere' }}>{c.name}</Text>
                            <Tooltip label="Free this gift up">
                              <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Free up ${c.name}'s claim`} onClick={() => removeClaim(c)}>×</ActionIcon>
                            </Tooltip>
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="xs" c="dimmed">Nobody has taken this yet</Text>
                    )}
                    <Group gap="xs" mt={4}>
                      {item.url && (
                        <Button component="a" href={item.url} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="default">
                          Open link
                        </Button>
                      )}
                      <Button size="compact-sm" variant="light" onClick={() => requestUnlock(() => setEditing(item))}>Edit</Button>
                      <Button size="compact-sm" variant="subtle" color="gray" onClick={() => toggleHidden(item)}>{item.hidden ? 'Show' : 'Hide'}</Button>
                      <Button size="compact-sm" variant="subtle" color="red" onClick={() => remove(item)}>Delete</Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </>
      )}

      {loaded && !loadError && items.length === 0 && (
        <EmptyState
          emoji="🎁"
          title="No gifts on the list yet"
          hint="Add things we need for the new home: paste a link from Amazon, Flipkart or any shop and we will try to fill in the name, picture and price. Or just add a picture and a price range."
          action={<EditButton onClick={() => setEditing('new')}>Add the first gift</EditButton>}
        />
      )}

      {editing && (
        <WishlistEditor key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} opened onClose={() => setEditing(null)} onSaved={() => void load()} />
      )}
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.6 }}>{label}</Text>
      <Text fw={600} fz="lg">{value}</Text>
    </div>
  );
}
