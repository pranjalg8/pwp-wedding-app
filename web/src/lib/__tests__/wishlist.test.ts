import { describe, expect, it } from 'vitest';
import { checkClaim, checkUnclaim, publicItem } from '../../../../supabase/functions/wishlist/rules';
import { checkFetchUrl, cleanTitle, meta, parseProduct, privateIp, rupees, storeName } from '../../../../supabase/functions/wishlist-fetch/parse';
import { BUDGETS, fitsBudget, formatPrice, parsePrice } from '../wishlist';

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

describe('formatPrice and parsePrice', () => {
  it('shows a range, a single price, or nothing', () => {
    expect(formatPrice(1200, 1800)).toBe('₹1,200 – ₹1,800');
    expect(formatPrice(1200, 1200)).toBe('₹1,200');
    expect(formatPrice(null, 900)).toBe('₹900');
    expect(formatPrice(null, null)).toBe('');
    expect(formatPrice(150000, 250000)).toBe('₹1,50,000 – ₹2,50,000');
  });
  it('reads whole rupees from what is typed', () => {
    expect(parsePrice('₹1,299')).toBe(1299);
    expect(parsePrice(' 1 200 ')).toBe(1200);
    expect(parsePrice('1299.6')).toBe(1300);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('free')).toBeNull();
  });
});

describe('fitsBudget', () => {
  const band = (k: string) => k as (typeof BUDGETS)[number]['key'];
  it('lets any item through for "any budget"', () => {
    expect(fitsBudget({ price_min: 99999, price_max: 99999 }, band('all'))).toBe(true);
  });
  it('matches a range that touches the band', () => {
    expect(fitsBudget({ price_min: 800, price_max: 1500 }, band('u1'))).toBe(true);
    expect(fitsBudget({ price_min: 800, price_max: 1500 }, band('u5'))).toBe(true);
    expect(fitsBudget({ price_min: 800, price_max: 1500 }, band('o15'))).toBe(false);
    expect(fitsBudget({ price_min: 20000, price_max: 25000 }, band('u15'))).toBe(false);
    expect(fitsBudget({ price_min: 20000, price_max: 25000 }, band('o15'))).toBe(true);
  });
  it('keeps an item with no price in every band', () => {
    for (const b of BUDGETS) expect(fitsBudget({ price_min: null, price_max: null }, b.key)).toBe(true);
  });
});

describe('claim checks', () => {
  it('accepts a good claim and trims the name', () => {
    const r = checkClaim({ id: ID.toUpperCase(), name: '  Asha   Rao ', token: TOKEN });
    expect(r).toEqual({ claim: { id: ID, name: 'Asha Rao', token: TOKEN } });
  });
  it('refuses a missing name, a bad id or a weak secret', () => {
    expect('error' in checkClaim({ id: ID, name: ' ', token: TOKEN })).toBe(true);
    expect('error' in checkClaim({ id: 'nope', name: 'A', token: TOKEN })).toBe(true);
    expect('error' in checkClaim({ id: ID, name: 'A', token: 'short' })).toBe(true);
    expect('error' in checkUnclaim({ id: ID, token: 'has spaces and is long enough to pass length' })).toBe(true);
    expect('undo' in checkUnclaim({ id: ID, token: TOKEN })).toBe(true);
  });
  it('shows friends how many are left and never who took them', () => {
    const row = { id: ID, title: 'Kettle', note: null, category: 'Kitchen', url: null, image_url: null, price_min: 1000, price_max: 1500, quantity: 2 };
    const shown = publicItem(row, 1);
    expect(shown.left).toBe(1);
    expect(Object.keys(shown)).not.toContain('name');
    expect(publicItem(row, 5).left).toBe(0);
  });
});

describe('checkFetchUrl', () => {
  it('allows ordinary shop addresses', () => {
    expect('url' in checkFetchUrl('https://www.amazon.in/dp/B0ABC')).toBe(true);
    expect('url' in checkFetchUrl('http://flipkart.com/x')).toBe(true);
  });
  it('refuses private, internal and odd addresses', () => {
    for (const bad of ['http://localhost/x', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'https://user:pw@amazon.in/', 'https://amazon.in:8443/', 'ftp://amazon.in/', 'file:///etc/passwd', 'http://printer.local/', 'http://intranet/', 'not a url']) {
      expect(checkFetchUrl(bad), bad).toHaveProperty('error');
    }
  });
  it('knows private address ranges', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(privateIp(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '104.16.0.1', '2606:4700::1111']) expect(privateIp(ip), ip).toBe(false);
  });
});

describe('storeName', () => {
  it('names the big shops and falls back to the site', () => {
    expect(storeName('https://www.amazon.in/dp/x')).toBe('Amazon');
    expect(storeName('https://amzn.in/d/abc')).toBe('Amazon');
    expect(storeName('https://dl.flipkart.com/s/x')).toBe('Flipkart');
    expect(storeName('https://fkrt.cc/abc')).toBe('Flipkart');
    expect(storeName('https://www.somehomestore.in/p/1')).toBe('somehomestore.in');
    expect(storeName('nonsense')).toBeNull();
  });
});

describe('reading a product page', () => {
  it('reads schema.org product data', () => {
    const html = `<html><head><title>x</title><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Prestige Induction Cooktop',
      image: ['/img/a.jpg'],
      offers: { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: '2,499.00', highPrice: '3200' },
    })}</script></head></html>`;
    expect(parseProduct(html, 'https://shop.example.in/p/1')).toEqual({
      title: 'Prestige Induction Cooktop',
      image: 'https://shop.example.in/img/a.jpg',
      price_min: 2499,
      price_max: 3200,
    });
  });
  it('finds a product inside @graph and ignores other currencies', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebSite' }, { '@type': 'Product', name: 'Rug', offers: [{ priceCurrency: 'USD', price: 40 }] }] })}</script>`;
    const r = parseProduct(html, 'https://x.com/');
    expect(r.title).toBe('Rug');
    expect(r.price_min).toBeNull();
  });
  it('falls back to open-graph tags in either attribute order', () => {
    const html = `<head><meta content="Bedsheet &amp; pillow set : Amazon.in: Home &amp; Kitchen" property="og:title"><meta property="og:image" content="https://m.media-amazon.com/images/I/x.jpg"><meta property="product:price:amount" content="₹1,099"><meta property="product:price:currency" content="INR"></head>`;
    expect(parseProduct(html, 'https://www.amazon.in/dp/x')).toEqual({
      title: 'Bedsheet & pillow set',
      image: 'https://m.media-amazon.com/images/I/x.jpg',
      price_min: 1099,
      price_max: 1099,
    });
  });
  it('uses the page title when there is nothing else, and refuses non-web images', () => {
    const r = parseProduct('<title>Plain Kettle | Shop</title><meta property="og:image" content="javascript:alert(1)">', 'https://x.in/');
    expect(r.title).toBe('Plain Kettle');
    expect(r.image).toBeNull();
  });
  it('survives broken JSON-LD and empty pages', () => {
    expect(parseProduct('<script type="application/ld+json">{not json</script>', 'https://x.in/')).toEqual({ title: null, image: null, price_min: null, price_max: null });
  });
  it('has small helpers that behave', () => {
    expect(rupees('Rs. 1,299.50')).toBe(1300);
    expect(rupees('')).toBeNull();
    expect(rupees(0)).toBeNull();
    expect(meta('<meta name="Description" content=\'it&#39;s nice\'>', ['description'])).toBe("it's nice");
    expect(cleanTitle('Steel Bottle - Buy Steel Bottle Online at Best Prices')).toBe('Steel Bottle');
  });
});
