/** Fields are optional throughout the API, so every formatter may return null. */

export function formatCost(site) {
  if (site.admissionCost === undefined) return null;
  if (site.admissionCost === 0) return 'Free';

  const currency = site.currency ?? 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(site.admissionCost);
  } catch {
    // An unrecognised currency code should not take the card down with it.
    return `${site.admissionCost} ${currency}`;
  }
}

export function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatDistance(km) {
  if (km === undefined || km === null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km} km away`;
}
