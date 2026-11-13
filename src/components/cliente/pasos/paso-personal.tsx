"use client";

import type { ComponentProps } from "react";
import { FormularioPaso } from "../formulario-paso.tsx";

// Paso «personal» del asistente: el formulario genérico con la configuración de ese paso.
export function PasoPersonal(props: Omit<ComponentProps<typeof FormularioPaso>, "paso">) {
  return <FormularioPaso paso="personal" {...props} />;
}
