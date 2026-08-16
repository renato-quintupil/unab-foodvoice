/**
 * Hash de contraseñas (T050, D-002, FR-008, SC-027, architecture CHK004).
 */
import * as bcrypt from 'bcrypt';
import { COSTE_BCRYPT, HashingService } from './hashing.service';

describe('HashingService', () => {
  let servicio: HashingService;

  beforeEach(() => {
    servicio = new HashingService();
    servicio.onModuleInit();
  });

  it('usa bcrypt con coste 12 (D-002)', async () => {
    expect(COSTE_BCRYPT).toBe(12);
    const hash = await servicio.hash('contrasena8');
    expect(bcrypt.getRounds(hash)).toBe(12);
  });

  it('dos usuarios con la misma contraseña producen hashes distintos', async () => {
    // Delata la ausencia de sal: sin ella, la misma contraseña daría el mismo
    // hash y una filtración de la tabla revelaría quiénes la comparten.
    const [uno, otro] = await Promise.all([
      servicio.hash('la-misma-clave'),
      servicio.hash('la-misma-clave'),
    ]);
    expect(uno).not.toBe(otro);
    expect(await servicio.comparar('la-misma-clave', uno)).toBe(true);
    expect(await servicio.comparar('la-misma-clave', otro)).toBe(true);
  });

  it('verifica correctamente y rechaza una contraseña incorrecta', async () => {
    const hash = await servicio.hash('contrasena8');
    expect(await servicio.comparar('contrasena8', hash)).toBe(true);
    expect(await servicio.comparar('Contrasena8', hash)).toBe(false);
    expect(await servicio.comparar('otra-cosa', hash)).toBe(false);
  });

  it('el coste incrustado en el señuelo coincide con el configurado', async () => {
    // Un señuelo de coste distinto al configurado tarda menos en compararse y
    // reabre en silencio la diferencia de temporización que existe para cerrar.
    // Que el señuelo se genere al arrancar, y no como literal, es lo que hace
    // que cambiar la configuración no degrade la seguridad sin aviso.
    expect(bcrypt.getRounds(servicio.hashSenuelo())).toBe(COSTE_BCRYPT);
  });

  it('la comparación se ejecuta siempre, también sin usuario', async () => {
    // No se puede espiar `bcrypt.compare` —el módulo nativo no lo permite—, y
    // tampoco haría falta: lo que la defensa persigue no es que la llamada
    // ocurra sino que **cueste lo mismo**. Se mide, que es la propiedad real.
    const hash = await servicio.hash('contrasena8');

    const inicioReal = performance.now();
    await servicio.comparar('otra-cosa', hash);
    const duracionReal = performance.now() - inicioReal;

    const inicioSenuelo = performance.now();
    await servicio.compararContraSenuelo('otra-cosa');
    const duracionSenuelo = performance.now() - inicioSenuelo;

    // Ambas ejecutan un bcrypt de coste 12: decenas de milisegundos como
    // mínimo. Un señuelo que no comparase nada tardaría microsegundos.
    expect(duracionSenuelo).toBeGreaterThan(20);
    // Y del mismo orden de magnitud que la verificación real: es lo que impide
    // que el tiempo de respuesta delate si el correo está registrado.
    expect(duracionSenuelo).toBeGreaterThan(duracionReal / 4);
    expect(duracionSenuelo).toBeLessThan(duracionReal * 4);
  });

  it('la comparación contra el señuelo devuelve siempre falso', async () => {
    expect(await servicio.compararContraSenuelo('cualquiera')).toBe(false);
    expect(await servicio.compararContraSenuelo('')).toBe(false);
  });

  it('el señuelo no es un literal del código: cambia entre arranques', () => {
    const otroArranque = new HashingService();
    otroArranque.onModuleInit();
    expect(otroArranque.hashSenuelo()).not.toBe(servicio.hashSenuelo());
  });
});
