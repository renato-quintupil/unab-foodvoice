import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/** Coste de bcrypt (D-002). 200–400 ms de CPU por intento, acertado o fallido. */
export const COSTE_BCRYPT = 12;

/**
 * Hash y verificación de contraseñas (D-002, FR-007, FR-016).
 *
 * El **hash señuelo** se genera al arrancar **con el mismo coste configurado**,
 * nunca escrito como literal (architecture CHK004). La razón importa: la
 * comparación bcrypt se ejecuta siempre, exista o no la cuenta, para que el
 * tiempo de respuesta no delate si un correo está registrado (FR-008). Un
 * señuelo de coste distinto al configurado tarda menos en compararse y reabre
 * en silencio esa misma diferencia de temporización.
 */
@Injectable()
export class HashingService implements OnModuleInit {
  private senuelo!: string;

  onModuleInit(): void {
    // Contenido irrelevante y distinto en cada arranque: lo único que importa
    // es que sea un hash bcrypt legítimo del coste vigente.
    this.senuelo = bcrypt.hashSync(
      `senuelo-${Date.now()}-${Math.random()}`,
      COSTE_BCRYPT,
    );
  }

  async hash(contrasena: string): Promise<string> {
    return bcrypt.hash(contrasena, COSTE_BCRYPT);
  }

  async comparar(contrasena: string, hash: string): Promise<boolean> {
    return bcrypt.compare(contrasena, hash);
  }

  /**
   * Compara contra el señuelo y devuelve siempre `false`. Se llama cuando el
   * usuario no existe, para gastar el mismo tiempo que una verificación real.
   */
  async compararContraSenuelo(contrasena: string): Promise<boolean> {
    await bcrypt.compare(contrasena, this.senuelo);
    return false;
  }

  /** Expuesto solo para que su coste sea verificable desde las pruebas. */
  hashSenuelo(): string {
    return this.senuelo;
  }
}
