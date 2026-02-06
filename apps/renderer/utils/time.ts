const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

export const formatMessageTime = (timestamp: number): string => {
  return timeFormatter.format(new Date(timestamp));
};
