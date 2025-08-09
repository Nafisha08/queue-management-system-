const mongoose = require('mongoose');
const AppError = require('./AppError');

/**
 * Validate MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {boolean} - True if valid
 * @throws {AppError} - If invalid
 */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
  
  return true;
};

/**
 * Validate multiple ObjectIds
 * @param {Array} ids - Array of IDs to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {boolean} - True if all valid
 * @throws {AppError} - If any invalid
 */
const validateObjectIds = (ids, fieldName = 'IDs') => {
  if (!Array.isArray(ids)) {
    throw new AppError(`${fieldName} must be an array`, 400);
  }
  
  ids.forEach((id, index) => {
    try {
      validateObjectId(id, `${fieldName}[${index}]`);
    } catch (error) {
      throw error;
    }
  });
  
  return true;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (supports Indian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid format
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^(\+91[-\s]?)?[0]?(91)?[789]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ''));
};

/**
 * Validate required fields
 * @param {Object} data - Data object to validate
 * @param {Array} requiredFields - Array of required field names
 * @throws {AppError} - If any required field is missing
 */
const validateRequiredFields = (data, requiredFields) => {
  const missingFields = [];
  
  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
  });
  
  if (missingFields.length > 0) {
    throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
  }
};

/**
 * Validate date format and range
 * @param {string|Date} date - Date to validate
 * @param {string} fieldName - Name of the field for error message
 * @param {Object} options - Validation options
 * @returns {Date} - Parsed date if valid
 * @throws {AppError} - If invalid
 */
const validateDate = (date, fieldName = 'Date', options = {}) => {
  const parsedDate = new Date(date);
  
  if (isNaN(parsedDate.getTime())) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
  
  if (options.minDate && parsedDate < options.minDate) {
    throw new AppError(`${fieldName} cannot be earlier than ${options.minDate.toISOString()}`, 400);
  }
  
  if (options.maxDate && parsedDate > options.maxDate) {
    throw new AppError(`${fieldName} cannot be later than ${options.maxDate.toISOString()}`, 400);
  }
  
  return parsedDate;
};

/**
 * Validate numeric value and range
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @param {Object} options - Validation options
 * @returns {number} - Validated number
 * @throws {AppError} - If invalid
 */
const validateNumber = (value, fieldName = 'Value', options = {}) => {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }
  
  if (options.min !== undefined && num < options.min) {
    throw new AppError(`${fieldName} must be at least ${options.min}`, 400);
  }
  
  if (options.max !== undefined && num > options.max) {
    throw new AppError(`${fieldName} cannot be more than ${options.max}`, 400);
  }
  
  if (options.positive && num <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
  }
  
  if (options.integer && !Number.isInteger(num)) {
    throw new AppError(`${fieldName} must be an integer`, 400);
  }
  
  return num;
};

/**
 * Validate string length and format
 * @param {string} value - String to validate
 * @param {string} fieldName - Name of the field for error message
 * @param {Object} options - Validation options
 * @returns {string} - Validated string
 * @throws {AppError} - If invalid
 */
const validateString = (value, fieldName = 'Value', options = {}) => {
  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} must be a string`, 400);
  }
  
  if (options.minLength && value.length < options.minLength) {
    throw new AppError(`${fieldName} must be at least ${options.minLength} characters long`, 400);
  }
  
  if (options.maxLength && value.length > options.maxLength) {
    throw new AppError(`${fieldName} cannot be more than ${options.maxLength} characters long`, 400);
  }
  
  if (options.pattern && !options.pattern.test(value)) {
    throw new AppError(`${fieldName} format is invalid`, 400);
  }
  
  return value.trim();
};

/**
 * Validate array
 * @param {Array} value - Array to validate
 * @param {string} fieldName - Name of the field for error message
 * @param {Object} options - Validation options
 * @returns {Array} - Validated array
 * @throws {AppError} - If invalid
 */
const validateArray = (value, fieldName = 'Value', options = {}) => {
  if (!Array.isArray(value)) {
    throw new AppError(`${fieldName} must be an array`, 400);
  }
  
  if (options.minLength && value.length < options.minLength) {
    throw new AppError(`${fieldName} must contain at least ${options.minLength} items`, 400);
  }
  
  if (options.maxLength && value.length > options.maxLength) {
    throw new AppError(`${fieldName} cannot contain more than ${options.maxLength} items`, 400);
  }
  
  if (options.uniqueItems && new Set(value).size !== value.length) {
    throw new AppError(`${fieldName} must contain unique items`, 400);
  }
  
  return value;
};

module.exports = {
  validateObjectId,
  validateObjectIds,
  isValidEmail,
  isValidPhone,
  validateRequiredFields,
  validateDate,
  validateNumber,
  validateString,
  validateArray
};
