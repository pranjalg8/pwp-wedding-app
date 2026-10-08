// wa.me needs digits only with the country code; bare 10-digit Indian numbers get 91.
export function whatsappUrl(phone: string) {
  let digits = phone.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 ? `https://wa.me/${digits}` : null;
}
