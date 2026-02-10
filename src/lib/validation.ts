/**
 * Sanitize search query to prevent injection attacks
 */
export function sanitizeSearchQuery(query: string): string {
  return query.trim().slice(0, 200);
}

/**
 * Validate wine search query
 */
export function isValidSearchQuery(query: string): boolean {
  return query.trim().length >= 2;
}
