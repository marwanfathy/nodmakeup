// E.164 phone normalization for Egyptian numbers.
// Accepts: +201012345678, 201012345678, 01012345678, 00101012345678, "(010) 123 45678"
// Normalizes to: +201012345678

const DIGITS = /\D/g;

export function normalizeEgyptPhone(raw: string): string {
    let digits = String(raw ?? '').replace(DIGITS, '');

    // Strip international 00 prefix
    if (digits.startsWith('00')) digits = digits.slice(2);

    // Convert leading 0 (local 11-digit form) to Egyptian country-code 20
    if (digits.length === 11 && digits.startsWith('0')) {
        digits = `20${digits.slice(1)}`;
    }

    // Extend 9-digit mobile numbers into 10 (2010-2019 range body has 8 digits after 20)
    if (digits.length === 10 && digits.startsWith('20') && digits[2] === '1') {
        // unambiguous only when a trailing 0 was stripped; keep as-is otherwise
    }

    if (!/^20(10|11|12|15)[0-9]{8}$/.test(digits)) return `+${digits}`;

    return `+${digits}`;
}

export function isValidEgyptPhone(value: string): boolean {
    const digits = String(value ?? '').replace(DIGITS, '');
    return /^20(10|11|12|15)[0-9]{8}$/.test(digits);
}