import { describe, it, expect } from 'vitest';
import { AppError, InvalidCursorError, NotFoundError } from '../src/errors.js';

describe('app errors', () => {
  it('derives name from the class', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new InvalidCursorError().name).toBe('InvalidCursorError');
  });

  it('carries the status code the error handler maps', () => {
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new InvalidCursorError().statusCode).toBe(400);
  });

  it('is catchable as AppError and Error', () => {
    const err = new NotFoundError('Post not found');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Post not found');
  });
});
