const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidCustomDomain(
  host: string,
  platformDomain: string,
): boolean {
  if (host.length === 0 || host.length > 255 || !host.includes('.')) {
    return false;
  }

  const domain = platformDomain.trim().toLowerCase();
  if (host === domain || host.endsWith(`.${domain}`)) {
    return false;
  }

  return host.split('.').every((label) => HOST_LABEL.test(label));
}
