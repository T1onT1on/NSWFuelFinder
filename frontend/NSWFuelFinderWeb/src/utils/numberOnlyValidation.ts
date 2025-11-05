export type NumberOnlyValidationOptions = {
  fieldLabel: string;
  allowEmpty?: boolean;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  customPredicate?: (value: number) => boolean;
};

export type NumberOnlyValidationResult = {
  isValid: boolean;
  sanitizedValue: number | null;
  errorMessage?: string;
};

const DEFAULT_ERROR_PREFIX = "Enter a valid";

const toNumber = (candidate: unknown): number | null => {
  if (candidate === null || candidate === undefined) return null;

  if (typeof candidate === "number") {
    return Number.isFinite(candidate) ? candidate : null;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    if (!/^-?\d*(\.\d+)?$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const NumberOnlyValidation = (
  rawValue: unknown,
  {
    fieldLabel,
    allowEmpty = false,
    allowDecimal = true,
    min,
    max,
    customPredicate,
  }: NumberOnlyValidationOptions
): NumberOnlyValidationResult => {
  if (!fieldLabel || fieldLabel.trim().length === 0) {
    throw new Error("NumberOnlyValidation requires a non-empty fieldLabel");
  }

  if (allowEmpty && (rawValue === null || rawValue === undefined || rawValue === "")) {
    return { isValid: true, sanitizedValue: null };
  }

  const numericValue = toNumber(rawValue);
  if (numericValue === null) {
    return {
      isValid: false,
      sanitizedValue: null,
      errorMessage: `${DEFAULT_ERROR_PREFIX} "${fieldLabel}".`,
    };
  }

  if (!allowDecimal && !Number.isInteger(numericValue)) {
    return {
      isValid: false,
      sanitizedValue: null,
      errorMessage: `${DEFAULT_ERROR_PREFIX} "${fieldLabel}".`,
    };
  }

  if (typeof min === "number" && numericValue < min) {
    return {
      isValid: false,
      sanitizedValue: null,
      errorMessage: `${DEFAULT_ERROR_PREFIX} "${fieldLabel}".`,
    };
  }

  if (typeof max === "number" && numericValue > max) {
    return {
      isValid: false,
      sanitizedValue: null,
      errorMessage: `${DEFAULT_ERROR_PREFIX} "${fieldLabel}".`,
    };
  }

  if (customPredicate && !customPredicate(numericValue)) {
    return {
      isValid: false,
      sanitizedValue: null,
      errorMessage: `${DEFAULT_ERROR_PREFIX} "${fieldLabel}".`,
    };
  }

  return {
    isValid: true,
    sanitizedValue: numericValue,
  };
};
