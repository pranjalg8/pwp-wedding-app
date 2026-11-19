import { useRef, useState } from 'react';
import { Alert, Button, Group, Image, NumberInput, Select, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { supabase } from '../lib/supabase';
import { useDirty } from '../hooks/useDirty';
import { FormModal } from './FormModal';
import { CATEGORIES, isWebAddress, parsePrice, shrinkPicture, storeOf, type WishItem } from '../lib/wishlist';

type Found = { ok: boolean; partial?: boolean; reason?: string; store?: string | null; title?: string | null; image?: string | null; price_min?: number | null; price_max?: number | null; empty?: boolean };

// Add or change a wishlist item. "Fill from link" reads the product page and fills what is still blank;
// everything can also be typed in by hand, and a picture can be a web address or a photo from this device.
export function WishlistEditor({ item, opened, onClose, onSaved }: { item: WishItem | null; opened: boolean; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState(item?.url ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState(item?.category ?? 'Other');
  const [note, setNote] = useState(item?.note ?? '');
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');
  const [priceMin, setPriceMin] = useState<string | number>(item?.price_min ?? '');
  const [priceMax, setPriceMax] = useState<string | number>(item?.price_max ?? '');
  const [quantity, setQuantity] = useState<string | number>(item?.quantity ?? 1);
  const [hidden, setHidden] = useState(item?.hidden ?? false);
  const [filling, setFilling] = useState(false);
  const [fillNote, setFillNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const dirty = useDirty([url, title, category, note, imageUrl, priceMin, priceMax, quantity, hidden]);

  const min = priceMin === '' ? null : parsePrice(String(priceMin));
  const max = priceMax === '' ? null : parsePrice(String(priceMax));
  const qty = Number(quantity);
  const problem =
    !title.trim() ? 'Give the gift a name.'
    : url.trim() && !isWebAddress(url) ? 'The link needs to start with http:// or https://.'
    : imageUrl.trim() && !isWebAddress(imageUrl) ? 'The picture address needs to start with http:// or https://.'
    : min != null && max != null && max < min ? 'The highest price is lower than the lowest.'
    : !Number.isInteger(qty) || qty < 1 || qty > 20 ? 'How many: pick a number from 1 to 20.'
    : null;

  async function fillFromLink() {
    setFillNote(null);
    if (!isWebAddress(url)) {
      setFillNote('Paste a product link first (it should start with https://).');
      return;
    }
    setFilling(true);
    const { data, error: err } = await supabase.functions.invoke('wishlist-fetch', { body: { url: url.trim() } });
    setFilling(false);
    const found = data as Found | null;
    if (err || !found?.ok) {
      setFillNote(found?.reason ?? 'Could not read that link. Fill the details in by hand.');
      return;
    }
    const got: string[] = [];
    if (found.title && !title.trim()) { setTitle(found.title); got.push('name'); }
    if (found.image && !imageUrl.trim()) { setImageUrl(found.image); got.push('picture'); }
    if (found.price_min != null && min == null && max == null) {
      setPriceMin(found.price_min);
      setPriceMax(found.price_max ?? found.price_min);
      got.push('price');
    }
    setFillNote(
      got.length === 0
        ? found.empty
          ? 'The shop did not share any details. Fill them in by hand.'
          : 'Nothing new to fill: the name, picture and price are already there.'
        : `Filled in the ${got.join(', ')}${found.partial ? '. The shop did not share everything, so please check the rest.' : '. Please check them.'}`,
    );
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await shrinkPicture(file);
      const path = `${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from('wishlist').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (up.error) throw new Error(up.error.message);
      setImageUrl(supabase.storage.from('wishlist').getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(`Could not upload that picture: ${e instanceof Error ? e.message : 'try another one'}`);
    }
    setUploading(false);
    if (picker.current) picker.current.value = '';
  }

  async function save(): Promise<boolean> {
    if (problem) {
      setError(problem);
      return false;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      note: note.trim() || null,
      category,
      url: url.trim() || null,
      image_url: imageUrl.trim() || null,
      price_min: min ?? max,
      price_max: max ?? min,
      quantity: qty,
      hidden,
    };
    const res = item ? await supabase.from('wishlist_items').update(payload).eq('id', item.id) : await supabase.from('wishlist_items').insert(payload);
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return false;
    }
    onSaved();
    onClose();
    return true;
  }

  const store = storeOf(url.trim());

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={item ? 'Edit gift' : 'Add a gift'}
      onSubmit={save}
      canSubmit={!problem}
      submitting={saving || uploading}
      dirty={dirty}
      successMessage={item ? 'Gift saved' : 'Gift added to the list'}
      error={error}
    >
      <TextInput label="Link to the product" description="Amazon, Flipkart or any shop. Optional if you only have a picture." placeholder="https://www.amazon.in/..." value={url} onChange={(e) => setUrl(e.currentTarget.value)} inputMode="url" />
      <Group gap="sm">
        <Button variant="light" onClick={() => void fillFromLink()} loading={filling} disabled={!url.trim()}>
          Fill from link
        </Button>
        {store && <Text size="sm" c="dimmed">Store: {store}</Text>}
      </Group>
      {fillNote && <Alert color="gray" variant="light">{fillNote}</Alert>}
      <TextInput label="Gift" placeholder="e.g. Non-stick cookware set" value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus maxLength={160} required />
      <Group grow align="flex-start">
        <NumberInput label="Lowest price (₹)" placeholder="1,200" value={priceMin} onChange={setPriceMin} min={0} thousandSeparator="," hideControls />
        <NumberInput label="Highest price (₹)" placeholder="1,800" value={priceMax} onChange={setPriceMax} min={0} thousandSeparator="," hideControls />
      </Group>
      <Group grow align="flex-start">
        <Select label="Room or kind" data={CATEGORIES} value={category} onChange={(v) => setCategory(v ?? 'Other')} allowDeselect={false} />
        <NumberInput label="How many we need" description="Friends can take this many" value={quantity} onChange={setQuantity} min={1} max={20} allowDecimal={false} />
      </Group>
      <Textarea label="Note for friends" description="Colour, size or anything that helps. Optional." value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize minRows={2} maxLength={500} />
      <Stack gap={6}>
        <TextInput label="Picture" description="A web address, or upload a photo below." placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.currentTarget.value)} inputMode="url" />
        <Group gap="sm">
          <Button variant="default" size="xs" onClick={() => picker.current?.click()} loading={uploading}>
            Upload a picture
          </Button>
          {imageUrl && (
            <Button variant="subtle" size="xs" color="gray" onClick={() => setImageUrl('')}>
              Remove picture
            </Button>
          )}
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void upload(e.currentTarget.files?.[0])} />
        </Group>
        {imageUrl && isWebAddress(imageUrl) && <Image src={imageUrl} alt="" h={140} w="auto" fit="contain" radius="sm" style={{ alignSelf: 'flex-start' }} />}
      </Stack>
      <Switch label="Hide from friends for now" description="A draft: you can see it here, friends cannot." checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} />
    </FormModal>
  );
}
