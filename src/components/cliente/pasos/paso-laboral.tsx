"use client";

import type { ComponentProps } from "react";
import { FormularioPaso } from "../formulario-paso.tsx";

// Paso «laboral» del asistente: el formulario genérico con la configuración de ese paso.
export function PasoLaboral(props: Omit<ComponentProps<typeof FormularioPaso>, "paso">) {
  return <FormularioPaso paso="laboral" {...props} />;
}
