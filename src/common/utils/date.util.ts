/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Check if a date is expired
 */
export function isExpired(date: Date): boolean {
  return new Date() > date;
}

/**
 * Calculate time difference in minutes
 */
export function getMinutesDifference(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / 60000);
}

/**
 * Generate order number with format: ORD-YYYYMMDD-XXXXX
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 99999)).padStart(5, '0');

  return `ORD-${year}${month}${day}-${random}`;
}
