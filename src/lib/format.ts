export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

export const formatDateOnly = (value: string | Date) =>
  new Date(value).toISOString().split('T')[0];
