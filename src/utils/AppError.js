/**
 * Custom Application Error class
 * Extends the built-in Error class to add status code and operational flag
 */
class AppError extends Error {
  /**
   * Create an AppError
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {boolean} isOperational - Whether this is an operational error
   */
  constructor(message, statusCode, isOperational = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    
    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a BadRequest error (400)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static badRequest(message = 'Bad Request') {
    return new AppError(message, 400);
  }

  /**
   * Create an Unauthorized error (401)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  /**
   * Create a Forbidden error (403)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  /**
   * Create a NotFound error (404)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static notFound(message = 'Not Found') {
    return new AppError(message, 404);
  }

  /**
   * Create a Conflict error (409)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static conflict(message = 'Conflict') {
    return new AppError(message, 409);
  }

  /**
   * Create an Unprocessable Entity error (422)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static unprocessableEntity(message = 'Unprocessable Entity') {
    return new AppError(message, 422);
  }

  /**
   * Create an Internal Server Error (500)
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static internal(message = 'Internal Server Error') {
    return new AppError(message, 500, false);
  }

  /**
   * Convert the error to a JSON object
   * @returns {Object}
   */
  toJSON() {
    return {
      success: false,
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      isOperational: this.isOperational,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

module.exports = AppError;
