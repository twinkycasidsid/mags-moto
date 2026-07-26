export const sanitizeNumericInput = (
  value: string,
  options: { allowDecimal?: boolean } = {},
) => {
  const { allowDecimal = false } = options;
  const strippedValue = value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');

  if (!allowDecimal) {
    return strippedValue;
  }

  const [integerPart = '', ...decimalParts] = strippedValue.split('.');
  if (decimalParts.length === 0) {
    return strippedValue;
  }

  return `${integerPart}.${decimalParts.join('')}`;
};

export const parseSanitizedNumber = (value: string) => {
  if (!value || value === '.') {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};
