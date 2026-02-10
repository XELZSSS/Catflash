export const parseThinkTags = (value: string): { reasoning: string; cleaned: string } => {
  if (!value) return { reasoning: '', cleaned: '' };

  const completedThinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const reasoningParts: string[] = [];

  let cleaned = value.replace(completedThinkRegex, (_match, content: string) => {
    reasoningParts.push(content);
    return '';
  });

  const openThinkIndex = cleaned.toLowerCase().lastIndexOf('<think>');
  if (openThinkIndex !== -1) {
    const partialReasoning = cleaned.slice(openThinkIndex + '<think>'.length);
    reasoningParts.push(partialReasoning);
    cleaned = cleaned.slice(0, openThinkIndex);
  }

  return {
    reasoning: reasoningParts.join(''),
    cleaned: cleaned.trim(),
  };
};

export type ThinkStreamParserState = {
  cleaned: string;
  reasoning: string;
  inThink: boolean;
  carry: string;
};

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

const startsWithTagPrefix = (value: string): boolean => {
  const lower = value.toLowerCase();
  return THINK_OPEN.startsWith(lower) || THINK_CLOSE.startsWith(lower);
};

const splitStableSegment = (value: string): { stable: string; carry: string } => {
  const lastLt = value.lastIndexOf('<');
  if (lastLt === -1) {
    return { stable: value, carry: '' };
  }
  const tail = value.slice(lastLt);
  if (!startsWithTagPrefix(tail)) {
    return { stable: value, carry: '' };
  }
  return {
    stable: value.slice(0, lastLt),
    carry: tail,
  };
};

export const createThinkStreamParserState = (): ThinkStreamParserState => ({
  cleaned: '',
  reasoning: '',
  inThink: false,
  carry: '',
});

export const appendThinkStreamChunk = (
  state: ThinkStreamParserState,
  chunk: string
): ThinkStreamParserState => {
  if (!chunk) return state;

  const merged = `${state.carry}${chunk}`;
  const { stable, carry } = splitStableSegment(merged);
  let cursor = 0;
  let cleaned = state.cleaned;
  let reasoning = state.reasoning;
  let inThink = state.inThink;
  const stableLower = stable.toLowerCase();

  while (cursor < stable.length) {
    if (!inThink) {
      const openIndex = stableLower.indexOf(THINK_OPEN, cursor);
      if (openIndex === -1) {
        cleaned += stable.slice(cursor);
        break;
      }
      cleaned += stable.slice(cursor, openIndex);
      cursor = openIndex + THINK_OPEN.length;
      inThink = true;
      continue;
    }

    const closeIndex = stableLower.indexOf(THINK_CLOSE, cursor);
    if (closeIndex === -1) {
      reasoning += stable.slice(cursor);
      break;
    }
    reasoning += stable.slice(cursor, closeIndex);
    cursor = closeIndex + THINK_CLOSE.length;
    inThink = false;
  }

  return {
    cleaned,
    reasoning,
    inThink,
    carry,
  };
};

export const finalizeThinkStreamParserState = (
  state: ThinkStreamParserState
): { reasoning: string; cleaned: string } => {
  if (!state.carry) {
    return {
      reasoning: state.reasoning,
      cleaned: state.cleaned.trim(),
    };
  }

  if (state.inThink) {
    return {
      reasoning: `${state.reasoning}${state.carry}`,
      cleaned: state.cleaned.trim(),
    };
  }

  return {
    reasoning: state.reasoning,
    cleaned: `${state.cleaned}${state.carry}`.trim(),
  };
};
