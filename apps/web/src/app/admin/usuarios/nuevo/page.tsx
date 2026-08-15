import Link from 'next/link';
import { FormularioAlta } from './formulario-alta';

export const metadata = { title: 'Nuevo usuario · FoodVoice' };

/** Alta de un usuario (FR-009). */
export default function PaginaNuevoUsuario() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/usuarios" className="text-sm underline underline-offset-4">
          Volver a Usuarios
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo usuario</h1>
      </div>
      <FormularioAlta />
    </div>
  );
}
