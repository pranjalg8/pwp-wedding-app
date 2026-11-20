import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';

export type ConfirmDangerOptions = {
  title: string;
  message: ReactNode;
  // What the red button says, e.g. "Delete payment". Say the action, not "OK".
  confirmLabel: string;
  cancelLabel?: string;
  // Red by default. Pass another colour only for a confirm that is not destructive.
  confirmColor?: string;
};

// Ask before something destructive. Resolves true only when the red button is pressed;
// Cancel, Escape, the close button and clicking outside all resolve false.
export function confirmDanger({ title, message, confirmLabel, cancelLabel = 'Cancel', confirmColor = 'red' }: ConfirmDangerOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    modals.openConfirmModal({
      title,
      centered: true,
      children: typeof message === 'string' ? <Text size="sm">{message}</Text> : message,
      labels: { confirm: confirmLabel, cancel: cancelLabel },
      confirmProps: { color: confirmColor },
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}
