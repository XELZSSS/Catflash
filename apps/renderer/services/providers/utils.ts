export const sanitizeApiKey = (value?: string): string | undefined => {
  if (!value || value === 'undefined') return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^PLACEHOLDER_/i.test(trimmed)) return undefined;
  return trimmed.length > 0 ? trimmed : undefined;
};
