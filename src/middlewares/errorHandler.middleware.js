import { ApiError } from '../utils/ApiError.js';

const errorHandler = (err, req, res, next) => {

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: err.success,
      message: err.message,
      data: err.data,
      errors: err.errors,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Server Error',
    data: null,
    errors: [],
  });
};

export default errorHandler;