import { Anchor, Badge, Button, Group, Image, Modal, Stack, Text, Title } from '@mantine/core';
import { cardImageUrl } from '../lib/cardImage';
import type { SwipeCard } from '../lib/supabase';

export function CardDetails({ card, onClose }: { card: SwipeCard | null; onClose: () => void }) {
  const img = card ? cardImageUrl(card) : null;
  return (
    <Modal
      opened={card !== null}
      onClose={onClose}
      size="lg"
      padding={0}
      radius="lg"
      withCloseButton
      title={null}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
    >
      {card && (
        <Stack gap={0}>
          {img && <Image src={img} alt={card.title} h={240} fit="cover" />}
          <Stack gap="md" p="lg">
            <div>
              {card.category && (
                <Badge variant="light" mb={6}>
                  {card.category}
                </Badge>
              )}
              <Title order={3}>
                {card.emoji} {card.title}
              </Title>
              {card.subtitle && (
                <Text c="dimmed" mt={2}>
                  {card.subtitle}
                </Text>
              )}
            </div>

            {card.detail && <Text>{card.detail}</Text>}

            {card.facts.length > 0 && (
              <Stack gap={6}>
                {card.facts.map((f) => (
                  <Group key={f.label} gap="xs" wrap="nowrap" align="flex-start">
                    <Text size="sm" fw={600} style={{ minWidth: 110 }}>
                      {f.label}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {f.value}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}

            {card.links.length > 0 && (
              <Group gap="xs">
                {card.links.map((l) => (
                  <Button
                    key={l.url}
                    component="a"
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="light"
                    size="xs"
                  >
                    {l.label} ↗
                  </Button>
                ))}
              </Group>
            )}

            {card.image_credit && (
              <Text size="xs" c="dimmed">
                {card.image_source_url ? (
                  <Anchor href={card.image_source_url} target="_blank" rel="noopener noreferrer" c="dimmed" size="xs">
                    {card.image_credit}
                  </Anchor>
                ) : (
                  card.image_credit
                )}
              </Text>
            )}
          </Stack>
        </Stack>
      )}
    </Modal>
  );
}
