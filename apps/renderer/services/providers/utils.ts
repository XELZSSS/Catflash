import { readAppStorage } from '../storageKeys';

export const sanitizeApiKey = (value?: string): string | undefined => {
  if (!value || value === 'undefined') return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^PLACEHOLDER_/i.test(trimmed)) return undefined;
  return trimmed.length > 0 ? trimmed : undefined;
};

export const DEFAULT_MAX_TOOL_CALL_ROUNDS = 5;
export const MIN_TOOL_CALL_ROUNDS = 1;
export const MAX_TOOL_CALL_ROUNDS = 12;

const clampToolRounds = (value: number): number =>
  Math.min(Math.max(value, MIN_TOOL_CALL_ROUNDS), MAX_TOOL_CALL_ROUNDS);

export const getMaxToolCallRounds = (): number => {
  if (typeof window !== 'undefined') {
    const stored = readAppStorage('toolCallMaxRounds');
    const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN;
    if (!Number.isNaN(parsed)) return clampToolRounds(parsed);
  }
  const raw = process.env.TOOL_CALL_MAX_ROUNDS ?? process.env.MAX_TOOL_CALL_ROUNDS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isNaN(parsed)) return DEFAULT_MAX_TOOL_CALL_ROUNDS;
  return clampToolRounds(parsed);
};
