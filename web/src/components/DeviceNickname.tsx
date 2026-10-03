import { useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { getDeviceNickname, setDeviceNickname } from '../lib/device';

export function DeviceNicknameButton() {
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState(getDeviceNickname() ?? '');
  const current = getDeviceNickname();

  function handleSave() {
    setDeviceNickname(value.trim());
    setOpened(false);
  }

  return (
    <>
      <Button variant="subtle" size="sm" onClick={() => setOpened(true)}>
        {current ? current : 'Name this device'}
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title="This device's name" centered>
        <Stack>
          <Text size="sm" c="dimmed">
            Shown in the Activity log next to any manual change made from this browser, e.g.
            "Pranjal's laptop" or "Paridhi's phone". Stored only in this browser.
          </Text>
          <TextInput
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            placeholder="e.g. Pranjal's laptop"
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
