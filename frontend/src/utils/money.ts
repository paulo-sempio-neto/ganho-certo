export function normalizeDecimalInput(value: string): string {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Verifique os campos numericos informados.");
  }

  return normalized;
}

export function moneyInputToApi(value: string): string {
  const cleaned = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  let normalized = cleaned;

  if (decimalIndex >= 0) {
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimalPart = cleaned.slice(decimalIndex + 1);
    if (!integerPart || !decimalPart) {
      throw new Error("Informe um valor em reais, por exemplo 250,50.");
    }

    if (decimalPart.length <= 2) {
      normalized = `${integerPart}.${decimalPart}`;
    } else if (
      decimalPart.length === 3 &&
      (lastComma < 0 || lastDot < 0) &&
      /^[\d.]+$/.test(cleaned)
    ) {
      normalized = `${cleaned.replace(/[.,]/g, "")}.00`;
    }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe um valor em reais, por exemplo 250,50.");
  }

  const [reais, cents = ""] = normalized.split(".");
  const safeReais = reais.replace(/^0+(?=\d)/, "") || "0";
  const safeCents = `${cents}00`.slice(0, 2);
  return `${safeReais}.${safeCents}`;
}

export function optionalMoneyInputToApi(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return moneyInputToApi(value);
}

export function optionalDecimalInputToApi(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return normalizeDecimalInput(value);
}

export function formatMoney(value: string): string {
  const [reais, cents = "00"] = value.split(".");
  const groupedReais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${groupedReais},${`${cents}00`.slice(0, 2)}`;
}

export function formatMoneyPerKm(value: string): string {
  const [reais, fraction = ""] = value.split(".");
  const groupedReais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const safeFraction = fraction ? `,${fraction}` : "";
  return `R$ ${groupedReais}${safeFraction}/km`;
}

export function formatOptionalMoneyForInput(value: string | null): string {
  return value ? formatMoney(value).replace("R$ ", "") : "";
}

export function formatOptionalDecimalForInput(value: string | null): string {
  return value ? value.replace(".", ",") : "";
}

export function moneyInputToCents(value: string): bigint {
  return BigInt(moneyInputToApi(value).replace(".", ""));
}

export function moneyValueToCents(value: string): bigint {
  const isNegative = value.startsWith("-");
  const safeValue = isNegative ? value.slice(1) : value;
  const [reais, cents = "00"] = safeValue.split(".");
  const amount = BigInt(`${reais}${`${cents}00`.slice(0, 2)}`);
  return isNegative ? -amount : amount;
}

export function parseNonNegativeDecimal(value: string, fieldName: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Informe ${fieldName} corretamente.`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  return {
    units: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

export function divideAndRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("NÃ£o Ã© possÃ­vel dividir por zero.");
  }

  const isNegative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return isNegative ? -rounded : rounded;
}

export function formatCents(value: bigint): string {
  const isNegative = value < 0n;
  const absolute = isNegative ? -value : value;
  const reais = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = (absolute % 100n).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}R$ ${reais},${cents}`;
}
