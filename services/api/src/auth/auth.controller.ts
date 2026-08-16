import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { LoginSchema, type LoginInput, type SessionUser } from '@foodvoice/shared';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService, ResultadoLogin } from './auth.service';
import { COOKIE_SESION, SessionService } from './session.service';

/**
 * Opciones de la cookie de sesión (D-001, D-013).
 *
 * `httpOnly` para que el identificador nunca sea accesible desde el JavaScript
 * de la página; `SameSite=Lax` porque el navegador solo habla con Next.js y la
 * cookie es same-origin (D-006); y `Secure` **solo en producción**, porque en
 * desarrollo local sobre `http://localhost` una cookie `Secure` no se envía y
 * la sesión no funcionaría. El cifrado del canal en el despliegue real es
 * responsabilidad del proxy que quede delante de `web` y queda fuera de v1.
 */
export function opcionesDeCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sesiones: SessionService,
  ) {}

  /** `POST /api/v1/auth/login` (FR-001, FR-031). */
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(
    @Body() datos: LoginInput,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<Omit<ResultadoLogin, 'sessionId'>> {
    const { sessionId, user, redirectTo } = await this.auth.iniciarSesion(datos);
    respuesta.cookie(COOKIE_SESION, sessionId, opcionesDeCookie());
    return { user, redirectTo };
  }

  /**
   * `POST /api/v1/auth/logout` (FR-006).
   *
   * Revoca **solo la sesión desde la que se cierra**, dejando intactas las demás
   * del mismo usuario en otros navegadores. Es idempotente: una sesión ya
   * inválida devuelve igualmente 204 — aunque en ese caso el guard responde
   * antes con 401, que es el comportamiento correcto para una cookie muerta.
   */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(
    @Req() peticion: PeticionConSesion,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<void> {
    await this.sesiones.revocarUna(peticion.sesion.sessionId);
    respuesta.clearCookie(COOKIE_SESION, { path: '/' });
  }

  /**
   * `GET /api/v1/auth/me` (FR-004, FR-005, FR-011, FR-031).
   *
   * El `role` proviene de la **sesión**, no del usuario. Refresca
   * `last_activity_at` como cualquier otra petición autenticada — lo hace el
   * guard, en la misma sentencia que la validación.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  yo(@Req() peticion: PeticionConSesion): SessionUser {
    const { userId, fullName, email, role } = peticion.sesion;
    return { id: userId, fullName, email, role };
  }
}
