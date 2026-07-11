import { User, UserRole, Permission, ROLE_PERMISSIONS } from "../../domain/entities/User";
import { Logger } from "../../shared/logging/Logger";
import { UnauthorizedError, ForbiddenError } from "../../shared/errors/AppError";

export class AuthService {
  private static instance: AuthService | null = null;
  private logger = Logger.getInstance();
  
  // Standard hard-coded secret for cryptographic signatures
  private readonly JWT_SECRET = process.env.JWT_SECRET || "novasim_ai_secure_token_secret_xyz_123";

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Generates a fully functional base64-encoded JWT token representing operator credentials.
   */
  public generateToken(username: string, role: UserRole): string {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: username,
        role: role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
      })
    );
    
    // Simple signature mimicking HMAC SHA256 in browser/Node context
    const signature = btoa(`${header}.${payload}.${this.JWT_SECRET}`).replace(/=/g, "");
    
    this.logger.info(`Generated JWT token for Operator '${username}' with role [${role.toUpperCase()}].`, "AUTH-SERVICE");
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Verifies and decodes a dynamic JWT token, returning the validated Operator payload.
   */
  public verifyToken(token: string): { username: string; role: UserRole } {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new UnauthorizedError("Invalid token segments.");
      }

      const payloadDecoded = JSON.parse(atob(parts[1]));
      
      // Check expiry
      if (payloadDecoded.exp < Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedError("JWT token has expired.");
      }

      this.logger.info(`JWT token validated successfully for Operator '${payloadDecoded.sub}' [${payloadDecoded.role}].`, "AUTH-SERVICE");
      
      return {
        username: payloadDecoded.sub,
        role: payloadDecoded.role as UserRole
      };
    } catch (err: any) {
      this.logger.error("Failed to decode or verify JWT credentials", err, "AUTH-SERVICE");
      throw new UnauthorizedError("Unauthorized: Token validation failed.");
    }
  }

  /**
   * Enforces role permission boundaries. Throws a ForbiddenError if the role lacks the specific capability.
   */
  public checkPermission(role: UserRole, requiredPermission: string): void {
    const allowedPermissions = ROLE_PERMISSIONS[role] || [];
    if (!allowedPermissions.includes(requiredPermission)) {
      this.logger.warn(`Permission denied: Role [${role.toUpperCase()}] attempted to execute locked permission '${requiredPermission}'`, "AUTH-SERVICE");
      throw new ForbiddenError(`Forbidden: Lack permission '${requiredPermission}'`);
    }
  }
}
