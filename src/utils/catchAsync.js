/**
 * Catch async errors and pass them to the error handler
 * This utility function eliminates the need to write try-catch blocks in every async route handler
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    // Execute the function and catch any errors
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
