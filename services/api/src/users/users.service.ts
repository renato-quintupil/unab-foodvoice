import { Injectable } from '@nestjs/common';
import { AdminAction, Prisma, Role, User, UserStatus } from '@prisma/client';
import {
  PAGE_SIZE,
  escaparLike,
  normalizarBusqueda,
  type CreateUserInput,
  type ListUsersQuery,
  type Paginated,
  type UpdateUserInput,
  type UserDto,
} from '@foodvoice/shared';
import { HashingService } from '../auth/hashing.service';
import { LoginAttemptService } from '../auth/login-attempt.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import { autoproteccion, correoYaExiste, noEncontrado } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

/** Código de PostgreSQL para violación de restricción única. */
const VIOLACION_DE_UNICIDAD = 'P2002';

/**
 * Gestión del padrón (T089, HU-09).
 *
 * Aquí viven **exactamente las reglas que exigen consultar el estado del
 * sistema**, que son las que la frontera de `shared.md` sitúa fuera de Zod: la
 * unicidad del correo, la autoprotección del administrador y la existencia del
 * recurso. Todo lo que puede decidirse mirando solo la petición lo validaron ya
 * los esquemas compartidos (D-005, api CHK031).
 *
 * Las cuatro acciones de impacto comparten estructura: **una única transacción**
 * que lee dentro, comprueba dentro, escribe, revoca sesiones y registra. Que
 * las comprobaciones estén dentro y no antes no es un detalle: leer fuera y
 * escribir dentro dejaría una ventana en la que el usuario puede cambiar entre
 * la comprobación y la acción.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly sesiones: SessionService,
    private readonly intentos: LoginAttemptService,
    private readonly auditoria: AuditService,
  ) {}

  /** `GET /admin/users` (FR-015, D-011, D-016). */
  async listar(consulta: ListUsersQuery): Promise<Paginated<UserDto>> {
    const where: Prisma.UserWhereInput = {};

    if (consulta.role) where.role = consulta.role;
    if (consulta.status) where.status = consulta.status;

    if (consulta.search && consulta.search.trim() !== '') {
      // La misma función que alimentó `search_normalized` al guardar, y el
      // escape **después** de normalizar: buscar `100%` busca ese texto
      // literal, no el padrón completo (D-011).
      const termino = escaparLike(normalizarBusqueda(consulta.search));
      where.searchNormalized = { contains: termino };
    }

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        // Orden total y estable. El desempate por `id` es obligatorio: sin él,
        // dos altas con la misma marca de tiempo pueden intercambiarse entre
        // consultas y hacer que un usuario aparezca en dos páginas o en
        // ninguna (D-016, SC-023).
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (consulta.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      items: filas.map(aDto),
      total,
      page: consulta.page,
      pageSize: PAGE_SIZE,
      // `page` fuera de rango devuelve 200 con `items: []`, conservando los
      // valores reales: pedir la página 5 de un resultado que quedó en 3 es lo
      // que ocurre cuando un filtro se estrecha mientras se navega, y no es un
      // error de validación.
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** `POST /admin/users` (FR-009, FR-017, FR-034). */
  async crear(datos: CreateUserInput, actorId: string): Promise<UserDto> {
    const passwordHash = await this.hashing.hash(datos.password);

    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.user.create({
          data: {
            fullName: datos.fullName,
            email: datos.email,
            phone: datos.phone,
            passwordHash,
            role: datos.role,
            status: UserStatus.ACTIVO,
            searchNormalized: normalizarBusqueda(`${datos.fullName} ${datos.email}`),
          },
        });

        await this.auditoria.registrar(
          { actorUserId: actorId, targetUserId: usuario.id, action: AdminAction.CREAR },
          tx,
        );

        return usuario;
      });

      return aDto(creado);
    } catch (error) {
      // La garantía de unicidad la da la **restricción del motor**, no una
      // comprobación previa: entre leer y escribir hay una ventana en la que
      // otra petición puede insertar la misma fila. Traducir la violación es
      // **obligatorio**; sin ella, una condición de carrera llegaría al
      // administrador como un `500`, es decir como un fallo del sistema en
      // lugar de como la regla de negocio que es (api CHK028, D-018).
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PATCH /admin/users/:id` (FR-010).
   *
   * **No revoca sesiones** y **no toca `login_attempt_control`**, ni para el
   * correo antiguo ni para el nuevo: esa tabla controla correos ingresados en
   * la pantalla de inicio de sesión, no usuarios (security CHK008, data CHK025).
   *
   * De ahí una consecuencia deliberada: si el correo nuevo tiene un bloqueo
   * vigente, el usuario editado queda sujeto a él aunque nunca haya fallado un
   * intento. Levantarlo automáticamente abriría un camino para eludir el
   * bloqueo —bastaría con que un administrador reasignara el correo—. Sus dos
   * salidas no exigen código nuevo: esperar, o pedir un restablecimiento.
   */
  async editar(id: string, datos: UpdateUserInput, actorId: string): Promise<UserDto> {
    try {
      const actualizado = await this.prisma.$transaction(async (tx) => {
        const actual = await tx.user.findUnique({ where: { id } });
        if (!actual) throw noEncontrado();

        const fullName = datos.fullName ?? actual.fullName;
        const email = datos.email ?? actual.email;

        const usuario = await tx.user.update({
          where: { id },
          data: {
            ...(datos.fullName !== undefined ? { fullName: datos.fullName } : {}),
            ...(datos.email !== undefined ? { email: datos.email } : {}),
            ...(datos.phone !== undefined ? { phone: datos.phone } : {}),
            // Se recalcula siempre que cambie el nombre o el correo, con la
            // misma función que usa la búsqueda.
            searchNormalized: normalizarBusqueda(`${fullName} ${email}`),
          },
        });

        await this.auditoria.registrar(
          { actorUserId: actorId, targetUserId: id, action: AdminAction.EDITAR },
          tx,
        );

        return usuario;
      });

      return aDto(actualizado);
    } catch (error) {
      throw traducirUnicidad(error);
    }
  }

  /**
   * `PUT /admin/users/:id/role` (FR-011, FR-024, FR-027).
   *
   * El nuevo rol rige a partir del **próximo inicio de sesión**: la revocación
   * termina la sesión abierta, no muta su rol en caliente —eso último es lo
   * que FR-011 prohíbe expresamente—. Sin la revocación, un usuario degradado
   * conservaría sus privilegios anteriores hasta 30 minutos (SC-026).
   */
  async cambiarRol(id: string, role: Role, actorId: string): Promise<UserDto> {
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.user.findUnique({ where: { id } });
      if (!actual) throw noEncontrado();
      if (id === actorId) throw autoproteccion();

      const usuario = await tx.user.update({ where: { id }, data: { role } });
      await this.sesiones.revocarTodasDe(id, tx);
      await this.auditoria.registrar(
        { actorUserId: actorId, targetUserId: id, action: AdminAction.CAMBIAR_ROL },
        tx,
      );

      return usuario;
    });

    return aDto(actualizado);
  }

  /**
   * `PUT /admin/users/:id/status` (FR-012, FR-013, FR-024, RN-002).
   *
   * **Estado solicitado igual al actual**: responde `200` sin cambios, sin
   * revocar sesiones y **sin registrar nada** (api CHK007). Desactivar a quien
   * ya está desactivado no es un error —el estado que se pedía es el que hay—,
   * pero tampoco es una acción: anotarla llenaría la bitácora de entradas que
   * no corresponden a ningún cambio, y revocar sesiones sería peor todavía,
   * porque expulsaría a un usuario activo por una petición que no modificó
   * nada. Con esta regla el endpoint es idempotente en el sentido pleno.
   */
  async cambiarEstado(id: string, status: UserStatus, actorId: string): Promise<UserDto> {
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.user.findUnique({ where: { id } });
      if (!actual) throw noEncontrado();
      if (id === actorId) throw autoproteccion();
      if (actual.status === status) return actual;

      const usuario = await tx.user.update({ where: { id }, data: { status } });
      await this.sesiones.revocarTodasDe(id, tx);
      await this.auditoria.registrar(
        {
          actorUserId: actorId,
          targetUserId: id,
          action:
            status === UserStatus.DESACTIVADO
              ? AdminAction.DESACTIVAR
              : AdminAction.REACTIVAR,
        },
        tx,
      );

      return usuario;
    });

    return aDto(actualizado);
  }

  /**
   * `POST /admin/users/:id/password-reset` (FR-026, FR-033, FR-034).
   *
   * Los cuatro efectos, en una transacción. La revocación (2) es lo que impide
   * que una sesión abierta siga operando con la credencial que acaba de
   * invalidarse; el borrado del bloqueo (3) es lo que levanta un bloqueo
   * temporal vigente de inmediato, y es la única salida rápida del caso en que
   * un usuario hereda el bloqueo del correo que se le asignó.
   */
  async restablecerContrasena(
    id: string,
    password: string,
    actorId: string,
  ): Promise<void> {
    const passwordHash = await this.hashing.hash(password);

    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.user.findUnique({ where: { id } });
      if (!actual) throw noEncontrado();

      await tx.user.update({ where: { id }, data: { passwordHash } });
      await this.sesiones.revocarTodasDe(id, tx);
      await this.intentos.limpiar(actual.email, tx);
      await this.auditoria.registrar(
        {
          actorUserId: actorId,
          targetUserId: id,
          action: AdminAction.RESTABLECER_PASSWORD,
        },
        tx,
      );
    });
  }
}

/**
 * `UserDto` es la única forma en que un usuario cruza la frontera de la API, y
 * esta función el único lugar que lo construye: la omisión de `passwordHash` es
 * estructural y no depende de recordar excluirlo en cada respuesta (FR-007,
 * FR-016). Tampoco expone `updatedAt` ni `searchNormalized`.
 */
function aDto(usuario: User): UserDto {
  return {
    id: usuario.id,
    fullName: usuario.fullName,
    email: usuario.email,
    phone: usuario.phone,
    role: usuario.role,
    status: usuario.status,
    createdAt: usuario.createdAt.toISOString(),
  };
}

function traducirUnicidad(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === VIOLACION_DE_UNICIDAD
  ) {
    // La respuesta no incluye el nombre de la restricción, el de la columna, el
    // valor del correo ni ningún fragmento del error del motor.
    return correoYaExiste();
  }
  return error;
}
