import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { getDeviceNickname, setDeviceNickname } from '../lib/device';

export function DeviceNicknameModal({
  opened,
  onClose,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [value, setValue] = useState(getDeviceNickname() ?? '');

  useEffect(() => {
    if (opened) setValue(getDeviceNickname() ?? '');
  }, [opened]);

  function handleSave() {
    const name = value.trim();
    setDeviceNickname(name);
    onSaved(name);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="This device's name" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Shown in the Activity log next to any manual change made from this browser, e.g. "Pranjal's laptop" or
          "Paridhi's phone". Stored only in this browser.
        </Text>
        <TextInput
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder="e.g. Pranjal's laptop"
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
