// Telegram bot utilities

/**
 * Generate a Telegram bot deep link
 * @param botUsername The username of the bot (without @)
 * @param startParam Optional start parameter
 * @returns The deep link URL
 */
export function generateBotLink(botUsername: string, startParam?: string): string {
  if (!botUsername) {
    return '#';
  }
  
  let url = `https://t.me/${botUsername}`;
  
  if (startParam) {
    url += `?start=${encodeURIComponent(startParam)}`;
  }
  
  return url;
}

/**
 * Extract the username from a bot token 
 * This requires the bot to be queried first, as the token doesn't contain the username
 * This is just a placeholder function for demonstration purposes
 */
export function extractBotUsername(token: string): string | null {
  // In a real implementation, you'd need to make an API call to Telegram to get the bot info
  // This is just a placeholder that returns null
  return null;
}

/**
 * Validate a Telegram bot token format
 * @param token The token to validate
 * @returns Whether the token has a valid format
 */
export function validateBotToken(token: string): boolean {
  // Simple validation: <numbers>:<alphanumeric string>
  const tokenRegex = /^\d+:[a-zA-Z0-9_-]+$/;
  return tokenRegex.test(token);
}

/**
 * Format a Telegram user ID and name for display
 * @param id User ID
 * @param firstName First name
 * @param lastName Last name (optional)
 * @param username Username (optional)
 * @returns Formatted display string
 */
export function formatTelegramUser(
  id: string,
  firstName: string,
  lastName?: string | null,
  username?: string | null
): string {
  let display = firstName;
  
  if (lastName) {
    display += ` ${lastName}`;
  }
  
  if (username) {
    display += ` (@${username})`;
  }
  
  return `${display} [ID: ${id}]`;
}
