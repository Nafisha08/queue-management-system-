/**
 * API Features class for handling query operations like filtering, sorting, pagination
 */
class APIFeatures {
  /**
   * Constructor
   * @param {Object} query - Mongoose query object
   * @param {Object} queryString - Request query parameters
   */
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  /**
   * Filter the query based on query parameters
   * @returns {APIFeatures} - Returns this for method chaining
   */
  filter() {
    // Create a copy of query string
    const queryObj = { ...this.queryString };
    
    // Fields to exclude from filtering
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach(field => delete queryObj[field]);

    // Handle search parameter
    if (this.queryString.search) {
      queryObj.$text = { $search: this.queryString.search };
    }

    // Advanced filtering (gte, gt, lte, lt)
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    
    // Parse back to object and apply to query
    const parsedQuery = JSON.parse(queryStr);
    this.query = this.query.find(parsedQuery);

    return this;
  }

  /**
   * Sort the query results
   * @returns {APIFeatures} - Returns this for method chaining
   */
  sort() {
    if (this.queryString.sort) {
      // Handle multiple sort fields: sort=name,-createdAt
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      // Default sort by creation date (newest first)
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  /**
   * Limit fields in the response
   * @returns {APIFeatures} - Returns this for method chaining
   */
  limitFields() {
    if (this.queryString.fields) {
      // Handle field selection: fields=name,email,-password
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      // Exclude __v field by default
      this.query = this.query.select('-__v');
    }

    return this;
  }

  /**
   * Paginate the results
   * @returns {APIFeatures} - Returns this for method chaining
   */
  paginate() {
    const page = this.queryString.page * 1 || 1; // Convert to number, default 1
    const limit = this.queryString.limit * 1 || 10; // Convert to number, default 10
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }

  /**
   * Add date range filtering
   * @param {string} dateField - The field to filter by date
   * @returns {APIFeatures} - Returns this for method chaining
   */
  dateRange(dateField = 'createdAt') {
    const { startDate, endDate } = this.queryString;
    
    if (startDate || endDate) {
      const dateFilter = {};
      
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // End of day
        dateFilter.$lte = endDateTime;
      }
      
      this.query = this.query.find({ [dateField]: dateFilter });
    }

    return this;
  }

  /**
   * Add text search functionality
   * @param {Array} searchFields - Fields to search in
   * @returns {APIFeatures} - Returns this for method chaining
   */
  search(searchFields = []) {
    if (this.queryString.search && searchFields.length > 0) {
      const searchRegex = new RegExp(this.queryString.search, 'i');
      const searchQuery = {
        $or: searchFields.map(field => ({ [field]: searchRegex }))
      };
      
      this.query = this.query.find(searchQuery);
    }

    return this;
  }

  /**
   * Add aggregation pipeline support
   * @param {Array} pipeline - Aggregation pipeline stages
   * @returns {APIFeatures} - Returns this for method chaining
   */
  aggregate(pipeline = []) {
    if (pipeline.length > 0) {
      this.query = this.query.aggregate(pipeline);
    }
    
    return this;
  }

  /**
   * Count total documents (for pagination info)
   * @returns {Promise<number>} - Total count
   */
  async countDocuments() {
    const Model = this.query.model;
    const filter = this.query.getQuery();
    return await Model.countDocuments(filter);
  }

  /**
   * Get pagination info
   * @param {number} total - Total number of documents
   * @returns {Object} - Pagination information
   */
  getPaginationInfo(total) {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      totalPages,
      total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null
    };
  }
}

module.exports = APIFeatures;
