/**
 * Simple logging utility with timestamp and level support
 */
class Logger {
  constructor(level = 'info') {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.currentLevel = this.levels[level] || this.levels.info;
  }

  /**
   * Formats a log message with timestamp and level
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @param {any} data - Optional data to include
   * @returns {string} Formatted log message
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataStr}`;
  }

  /**
   * Logs a message if the level is appropriate
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @param {any} data - Optional data to include
   */
  log(level, message, data = null) {
    if (this.levels[level] >= this.currentLevel) {
      console.log(this.formatMessage(level, message, data));
    }
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }
}

export const logger = new Logger();
