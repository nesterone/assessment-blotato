export class AppError extends Error {
  get name() {
    return this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  constructor(message = 'Not found') {
    super(message);
  }
}

export class InvalidCursorError extends AppError {
  readonly statusCode = 400;
  constructor(message = 'Invalid cursor') {
    super(message);
  }
}
