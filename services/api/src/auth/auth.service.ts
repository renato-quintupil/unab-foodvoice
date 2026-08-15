import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import type { LoginInput, SessionUser } from '@foodvoice/shared';
import { credencialesInvalidas, cuentaBloqueada } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from './hashing.service';
import { LoginAttemptService } from './login-attempt.service';
import { SessionService } from './session.service';

/** Destino tras el inicio de sesión, según el rol (FR-031). */
export const DESTINO_POR_ROL: Record<Role, string> = {
  [Role.CLIENTE]: '/cliente',
  [Role.NEGOCIO]: '/negocio',
  [Role.REPARTIDOR]: '/repartidor',
  [Role.ADMINISTRADOR]: '/admin',
};

export type ResultadoLogin = {
  sessionId: string;
  user: SessionUser;
  redirectTo: string;
};

/**
 * Inicio de sesión (FR-001, FR-008, FR-012, FR-033).
 *
 * Los **cinco pasos obligatorios** del contrato, en ese orden. El orden no es
 * estilístico: comprobar el bloqueo antes de tocar la contraseña es lo que
 * hace que un correo bloqueado se rechace exista o no la cuenta, y ejecutar la
 * comparación bcrypt siempre es lo que impide que el tiempo de respuesta
 * delate si un correo está registrado.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly intentos: LoginAttemptService,
    private readonly sesiones: SessionService,
  ) {}

  async iniciarSesion(datos: LoginInput): Promise<ResultadoLogin> {
    // 1. El correo llega ya normalizado por `LoginSchema` (D-005, D-015).
    const email = datos.email;

    // 2. Bloqueo vigente → 423 **sin comprobar la contraseña**, exista o no la
    //    cuenta (FR-033, FR-008).
    if (await this.intentos.estaBloqueado(email)) throw cuentaBloqueada();

    // 3. Buscar el usuario y ejecutar la comparación bcrypt **siempre**, contra
    //    un hash señuelo si no existe, para igualar los tiempos (D-002).
    const usuario = await this.prisma.user.findUnique({ where: { email } });

    const contrasenaCorrecta = usuario
      ? await this.hashing.comparar(datos.password, usuario.passwordHash)
      : await this.hashing.compararContraSenuelo(datos.password);

    // 4. Usuario inexistente, contraseña incorrecta o cuenta desactivada →
    //    registrar el fallo y responder el **mismo** 401. Los tres casos son
    //    indistinguibles desde fuera (FR-008, FR-012).
    if (!usuario || !contrasenaCorrecta || usuario.status !== UserStatus.ACTIVO) {
      await this.intentos.registrarFallo(email);
      throw credencialesInvalidas();
    }

    // 5. Éxito: el borrado del contador y la creación de la sesión van en **una
    //    sola transacción**. Separarlos permitiría entrar arrastrando fallos
    //    previos, o reiniciar el contador sin haber entrado (data CHK013).
    const sesion = await this.prisma.$transaction(async (tx) => {
      await this.intentos.limpiar(email, tx);
      return this.sesiones.crear(usuario.id, usuario.role, tx);
    });

    return {
      sessionId: sesion.id,
      user: {
        id: usuario.id,
        fullName: usuario.fullName,
        email: usuario.email,
        role: usuario.role,
      },
      redirectTo: DESTINO_POR_ROL[usuario.role],
    };
  }
}
