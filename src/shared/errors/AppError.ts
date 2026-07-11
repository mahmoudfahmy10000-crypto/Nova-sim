export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly status: number = 500,
    public readonly details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DomainError extends AppError {
  constructor(message: string, code: string = "DOMAIN_ERROR", details?: any) {
    super(message, code, 400, details);
  }
}

export class InfrastructureError extends AppError {
  constructor(message: string, code: string = "INFRASTRUCTURE_ERROR", details?: any) {
    super(message, code, 500, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required or credentials invalid", code: string = "UNAUTHORIZED") {
    super(message, code, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied for this resource", code: string = "FORBIDDEN") {
    super(message, code, 403);
  }
}
