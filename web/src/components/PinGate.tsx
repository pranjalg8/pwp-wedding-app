import { useRef, useState } from 'react';
import { ActionIcon, Button, Group, Modal, PinInput, Text, Tooltip } from '@mantine/core';
import { useEditMode } from '../hooks/useEditMode';

const LOCK_HINT = 'Edit mode stays on across refreshes and pages, and switches off after 30 minutes without activity';

// The PIN dialog. EditModeProvider renders one of these for the whole app; open it with requestUnlock().
export function PinModal({
  opened,
  onClose,
  onUnlocked,
}: {
  opened: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const { unlock } = useEditMode();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function close() {
    setPin('');
    setError(null);
    onClose();
  }

  async function submit(value: string) {
    // onComplete and Enter can both fire for the same PIN; only send it once.
    if (value.length < 4 || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await unlock(value);
    busyRef.current = false;
    setBusy(false);
    if (ok) {
      setPin('');
      setError(null);
      onUnlocked();
    } else {
      setError('Incorrect PIN, try again');
      setPin('');
      // Put the cursor back in the first box so the next try can start straight away.
      requestAnimationFrame(() => boxRef.current?.querySelector('input')?.focus());
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Enter admin PIN" centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(pin);
        }}
      >
        <Group justify="center" mb="sm" ref={boxRef}>
          <PinInput
            length={4}
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (error) setError(null);
            }}
            onComplete={(v) => void submit(v)}
            type="number"
            inputMode="numeric"
            autoFocus
            error={!!error}
            getInputProps={(index) => (index === 0 ? { 'data-autofocus': true } : {})}
          />
        </Group>
        {error && (
          <Text c="red" size="sm" ta="center" mb="sm" role="alert">
            {error}
          </Text>
        )}
        <Button type="submit" fullWidth loading={busy} disabled={pin.length < 4}>
          Unlock
        </Button>
      </form>
    </Modal>
  );
}

export function PinGateButton() {
  const { isUnlocked, lock, requestUnlock } = useEditMode();

  if (isUnlocked) {
    return (
      <Button color="red" variant="light" onClick={lock} title={LOCK_HINT}>
        Lock edit mode
      </Button>
    );
  }

  return (
    <Button variant="light" onClick={() => requestUnlock()}>
      Unlock edit mode
    </Button>
  );
}

// A compact lock / unlock toggle for the phone header, so edit mode is always visible.
export function PinGateIcon() {
  const { isUnlocked, lock, requestUnlock } = useEditMode();
  const label = isUnlocked ? 'Lock edit mode' : 'Unlock edit mode';
  return (
    <Tooltip label={isUnlocked ? `Editing on. ${LOCK_HINT}` : label} multiline w={240} events={{ hover: true, focus: false, touch: false }}>
      <ActionIcon
        size={40}
        radius="xl"
        variant={isUnlocked ? 'filled' : 'light'}
        color={isUnlocked ? 'rose' : 'gray'}
        onClick={() => (isUnlocked ? lock() : requestUnlock())}
        aria-label={label}
        aria-pressed={isUnlocked}
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
          {isUnlocked ? '🔓' : '🔒'}
        </span>
      </ActionIcon>
    </Tooltip>
  );
}
