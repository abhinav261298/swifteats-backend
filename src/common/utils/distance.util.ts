/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated delivery time
 * @param prepTime Preparation time in minutes
 * @param distance Distance in kilometers
 * @param avgSpeed Average speed in km/h (default 30 km/h)
 * @param buffer Buffer time in minutes (default 5 minutes)
 * @returns Estimated delivery time in minutes
 */
export function calculateDeliveryTime(
  prepTime: number,
  distance: number,
  avgSpeed: number = 30,
  buffer: number = 5,
): number {
  const travelTime = (distance / avgSpeed) * 60; // Convert to minutes
  return Math.ceil(prepTime + travelTime + buffer);
}
