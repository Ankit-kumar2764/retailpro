export function notFound(request, response) {
  response.status(404).json({ message: `Route not found: ${request.method} ${request.originalUrl}` });
}

export function errorHandler(error, _request, response, _next) {
  console.error('Unhandled API error:', error);
  response.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : 'Internal server error.',
  });
}
