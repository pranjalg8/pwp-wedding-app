import { useState } from 'react';
import { Button, Group, Modal, PinInput, Text } from '@mantine/core';
import { useEditMode } from '../hooks/useEditMode';

export function PinGateButton() {
  const { isUnlocked, unlock, lock } = useEditMode();
  const [opened, setOpened] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const ok = await unlock(pin);
    if (ok) {
      setOpened(false);
      setPin('');
      setError(null);
    } else {
      setError('Incorrect PIN');
    }
  }

  if (isUnlocked) {
    return (
      <Button color="red" variant="light" onClick={lock}>
        Lock edit mode
      </Button>
    );
  }

  return (
    <>
      <Button variant="light" onClick={() => setOpened(true)}>
        Unlock edit mode
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Enter admin PIN" centered>
        <Group justify="center" mb="sm">
          <PinInput length={4} value={pin} onChange={setPin} type="number" />
        </Group>
        {error && (
          <Text c="red" size="sm" ta="center" mb="sm">
            {error}
          </Text>
        )}
        <Button fullWidth onClick={handleSubmit} disabled={pin.length < 4}>
          Unlock
        </Button>
      </Modal>
    </>
  );
}
