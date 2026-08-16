import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  COOKIE_SESION,
  SesionValida,
  SessionService,
} from '../../auth/session.service';
import { sesionInvalida } from '../errors';

/** La petición lleva la sesión validada para los controladores. */
export type PeticionConSesion = Request & { sesion: SesionValida };

/**
 * Valida la cookie de sesión en cada petición autenticada (FR-005, api CHK027).
 *
 * **Los seis casos de cookie inválida producen exactamente la misma
 * respuesta**: cookie ausente, valor sin forma de UUID, UUID bien formado que
 * no existe, sesión revocada, sesión expirada por inactividad y sesión de un
 * usuario ya desactivado. Todos dan `401 UNAUTHENTICATED` con
 * `MSG_SESION_EXPIRADA` y la instrucción de borrado de la cookie.
 *
 * Que sean indistinguibles es deliberado: distinguir «esta sesión no existe» de
 * «esta sesión expiró» le diría a quien pruebe identificadores al azar cuándo
 * ha acertado uno, y no le sirve de nada al cliente legítimo — en los seis
 * casos lo único que puede hacer es volver a iniciar sesión.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sesiones: SessionService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const http = contexto.switchToHttp();
    const peticion = http.getRequest<PeticionConSesion>();
    const cookies = peticion.cookies as Record<string, string> | undefined;

    const sesion = await this.sesiones.validarYRefrescar(cookies?.[COOKIE_SESION]);

    if (!sesion) {
      // Se borra la cookie para que el navegador no siga enviando un valor
      // inservible en cada petición.
      http.getResponse<{ clearCookie: (n: string, o?: object) => void }>().clearCookie(
        COOKIE_SESION,
        { path: '/' },
      );
      throw sesionInvalida();
    }

    peticion.sesion = sesion;
    return true;
  }
}
