import type { FormEvent, ReactNode } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

// A modal form: Enter submits, it fills the screen on phones, Cancel and Save stay pinned at the bottom,
// and a stray tap outside does not throw away changes. On a successful save it shows a short toast.
export function FormModal({
  opened,
  onClose,
  title,
  children,
  onSubmit,
  canSubmit = true,
  submitting = false,
  dirty = false,
  submitLabel = 'Save',
  successMessage,
  error,
  size,
}: {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  // Resolve true when the save worked. The caller closes the modal itself.
  onSubmit: () => Promise<boolean>;
  canSubmit?: boolean;
  submitting?: boolean;
  // When true, a click outside does not close the modal.
  dirty?: boolean;
  submitLabel?: string;
  // Shown as a toast after a successful save, e.g. "Payment of ₹5,000 to Ravi saved".
  successMessage?: string | (() => string);
  error?: ReactNode;
  size?: string | number;
}) {
  const phone = useMediaQuery('(max-width: 48em)');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    const message = typeof successMessage === 'function' ? successMessage() : successMessage;
    const ok = await onSubmit();
    if (ok && message) notifications.show({ color: 'teal', message, autoClose: 3000 });
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size={size}
      fullScreen={!!phone}
      radius={phone ? 0 : undefined}
      closeOnClickOutside={!dirty}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack>
          {children}
          {error && (
            <Text c="red" size="sm" role="alert">
              {error}
            </Text>
          )}
        </Stack>
        <Group
          justify="flex-end"
          gap="sm"
          mt="md"
          py="sm"
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 1,
            background: 'var(--mantine-color-body)',
            borderTop: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
