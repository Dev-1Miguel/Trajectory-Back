import type { Request } from 'express';

export interface AuthenticatedUser {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
