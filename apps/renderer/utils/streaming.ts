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
