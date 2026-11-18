import type { ComponentPropsWithoutRef } from 'react';
import { Button, type ButtonProps } from '@mantine/core';
import { useEditMode } from '../hooks/useEditMode';

export type EditButtonProps = ButtonProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonProps | 'onClick'> & {
    /** Runs straight away when editing is on, otherwise after the PIN is entered. */
    onClick: () => void;
  };

// A main "Add ..." or "Edit ..." button that is always shown.
// When edit mode is locked it carries a small lock and asks for the PIN first.
export function EditButton({ onClick, leftSection, title, ...rest }: EditButtonProps) {
  const { isUnlocked, requestUnlock } = useEditMode();
  return (
    <Button
      {...rest}
      leftSection={isUnlocked ? leftSection : <span aria-hidden>🔒</span>}
      title={isUnlocked ? title : 'Enter the PIN to make changes'}
      onClick={() => requestUnlock(onClick)}
    />
  );
}
