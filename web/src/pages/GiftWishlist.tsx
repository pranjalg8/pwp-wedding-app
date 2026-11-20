import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoad } from '../hooks/useLoad';
import { Alert, Badge, Button, Card, Chip, Container, Group, Image, Loader, Modal, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import {
  BUDGETS, claimGift, fitsBudget, formatPrice, loadPublicList, myClaims, storeOf, unclaimGift,
  type BudgetKey, type PublicItem, type PublicList,
} from '../lib/wishlist';

type State = { phase: 'loading' } | { phase: 'error'; busy: boolean } | { phase: 'ready'; list: PublicList };

// The page friends open from the wishlist link. No login. It shows the items, lets a friend filter by room and
// budget, open the shop link, and mark "I'll gift this" with their name. It never shows who took what.
export function GiftWishlist() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [category, setCategory] = useState('all');
  const [budget, setBudget] = useState<BudgetKey>('all');
  const [taking, setTaking] = useState<PublicItem | null>(null);
  const [mine, setMine] = useState<Record<string, string>>(() => myClaims());
  const [thanks, setThanks] = useState<PublicItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState({ phase: 'ready', list: await loadPublicList() });
    } catch (e) {
      setState((s) => (s.phase === 'ready' ? s : { phase: 'error', busy: e instanceof Error && e.message === 'busy' }));
    }
  }, []);

  useLoad(load);
  useEffect(() => {
    document.title = 'Gift wishlist';
  }, []);

  const list = state.phase === 'ready' ? state.list : null;
  const items = useMemo(() => (list && list.open ? list.items : []), [list]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const shown = items.filter((i) => (category === 'all' || i.category === category) && fitsBudget(i, budget));

  async function undo(item: PublicItem) {
    setMessage(null);
    const res = await unclaimGift(item.id);
    setMine(myClaims());
    if (res.ok) await load();
    else setMessage(res.error);
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap={6} ta="center" align="center">
          <Text fz={36} aria-hidden>🎁</Text>
          <Title order={1} fz={{ base: 28, sm: 36 }}>Pranjal &amp; Paridhi's home wishlist</Title>
          <Text c="dimmed" maw={620}>
            Your blessings are the best gift. If you would like to give something for our new home, here are things we need,
            at every budget. Tap <b>I'll gift this</b> so nobody else buys the same thing.
          </Text>
        </Stack>

        {state.phase === 'loading' && (
          <Group justify="center" mt="xl">
            <Loader color="rose" />
          </Group>
        )}
        {state.phase === 'error' && (
          <Alert color="red" variant="light" title={state.busy ? 'A lot of people are looking right now' : 'Could not load the list'}>
            {state.busy ? 'Please try again in a little while.' : 'Please check your connection and try again.'}{' '}
            <Button size="compact-sm" variant="light" onClick={() => void load()}>Try again</Button>
          </Alert>
        )}
        {state.phase === 'ready' && !state.list.open && (
          <Alert color="gray" variant="light" title="The list is not open yet">We will share it soon. Please check back a little later.</Alert>
        )}

        {message && <Alert color="orange" variant="light" withCloseButton onClose={() => setMessage(null)}>{message}</Alert>}
        {thanks && (
          <Alert color="teal" variant="light" withCloseButton onClose={() => setThanks(null)} title="Thank you">
            We have marked <b>{thanks.title}</b> as yours.{' '}
            {thanks.url ? 'Please buy it from the link on the card.' : 'Please pick one like the picture.'} If your plans change, tap "Undo" on the card.
          </Alert>
        )}

        {state.phase === 'ready' && state.list.open && (
          <>
            {items.length === 0 ? (
              <Alert color="gray" variant="light" title="Nothing here yet">We are still putting the list together.</Alert>
            ) : (
              <>
                <Stack gap="xs">
                  {categories.length > 1 && (
                    <Chip.Group multiple={false} value={category} onChange={(v) => setCategory(v as string)}>
                      <Group gap="xs">
                        <Chip value="all" variant="outline">All</Chip>
                        {categories.map((c) => <Chip key={c} value={c} variant="outline">{c}</Chip>)}
                      </Group>
                    </Chip.Group>
                  )}
                  <Chip.Group multiple={false} value={budget} onChange={(v) => setBudget(v as BudgetKey)}>
                    <Group gap="xs">
                      {BUDGETS.map((b) => <Chip key={b.key} value={b.key} variant="outline" color="gold">{b.label}</Chip>)}
                    </Group>
                  </Chip.Group>
                </Stack>

                {shown.length === 0 ? (
                  <Text c="dimmed" ta="center">Nothing fits those choices. Try another room or budget.</Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
                    {shown.map((item) => {
                      const store = storeOf(item.url);
                      const gone = item.left === 0;
                      const yours = !!mine[item.id];
                      return (
                        <Card key={item.id} withBorder radius="md" p={0} style={{ opacity: gone && !yours ? 0.6 : 1 }}>
                          {item.image_url ? (
                            <Image src={item.image_url} alt="" h={200} fit="contain" fallbackSrc="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/%3E" />
                          ) : (
                            <Group h={120} justify="center" bg="var(--mantine-color-gray-light)">
                              <Text fz={40} aria-hidden>🎁</Text>
                            </Group>
                          )}
                          <Stack gap={6} p="md">
                            <Group gap={6}>
                              <Badge variant="light" color="gray">{item.category}</Badge>
                              {gone && <Badge color="teal" variant="light">{yours ? 'You are gifting this' : 'Already taken'}</Badge>}
                              {!gone && item.quantity > 1 && <Badge variant="outline" color="gray">{item.left} of {item.quantity} left</Badge>}
                              {gone && item.quantity > 1 && !yours && <Badge variant="outline" color="gray">All {item.quantity} taken</Badge>}
                            </Group>
                            <Text fw={600} lh={1.3}>{item.title}</Text>
                            {formatPrice(item.price_min, item.price_max) && <Text size="sm" fw={500}>{formatPrice(item.price_min, item.price_max)}</Text>}
                            {item.note && <Text size="sm" c="dimmed">{item.note}</Text>}
                            <Group gap="xs" mt={4}>
                              {item.url && (
                                <Button component="a" href={item.url} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="default">
                                  {store ? `View on ${store}` : 'View online'}
                                </Button>
                              )}
                              {yours ? (
                                <Button size="compact-sm" variant="subtle" color="gray" onClick={() => void undo(item)}>Undo</Button>
                              ) : (
                                !gone && <Button size="compact-sm" color="rose" onClick={() => setTaking(item)}>I'll gift this</Button>
                              )}
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })}
                  </SimpleGrid>
                )}
              </>
            )}
          </>
        )}
      </Stack>

      {taking && (
        <TakeModal
          item={taking}
          onClose={() => setTaking(null)}
          onDone={async () => {
            const item = taking;
            setTaking(null);
            setMine(myClaims());
            setThanks(item);
            await load();
          }}
          onTaken={async (error) => {
            setTaking(null);
            setMessage(error);
            await load();
          }}
        />
      )}
    </Container>
  );
}

function TakeModal({ item, onClose, onDone, onTaken }: { item: PublicItem; onClose: () => void; onDone: () => void; onTaken: (error: string) => void }) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(''); // a field people never see; robots fill it in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError('Please tell us your name.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await claimGift(item.id, name.trim(), website);
    setBusy(false);
    if (res.ok) onDone();
    else if (/last one|no longer/i.test(res.error)) onTaken(res.error);
    else setError(res.error);
  }

  return (
    <Modal opened onClose={onClose} title="I'll gift this" centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Stack>
          <Text size="sm">{item.title}</Text>
          <TextInput label="Your name" description="So we know whom to thank. Other guests will only see that it is taken." value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={60} data-autofocus required />
          <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.currentTarget.value)} tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
          {error && <Text c="red" size="sm" role="alert">{error}</Text>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" color="rose" loading={busy}>Mark as mine</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
