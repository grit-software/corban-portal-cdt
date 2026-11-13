"use client";

import type { ComponentProps } from "react";
import { FormularioPaso } from "../formulario-paso.tsx";

// Paso «cdt» del asistente: el formulario genérico con la configuración de ese paso.
export function PasoCdt(props: Omit<ComponentProps<typeof FormularioPaso>, "paso">) {
  return <FormularioPaso paso="cdt" {...props} />;
}
