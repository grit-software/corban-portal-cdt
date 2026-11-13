"use client";

import type { ComponentProps } from "react";
import { FormularioPaso } from "../formulario-paso.tsx";

// Paso «financiera» del asistente: el formulario genérico con la configuración de ese paso.
export function PasoFinanciera(props: Omit<ComponentProps<typeof FormularioPaso>, "paso">) {
  return <FormularioPaso paso="financiera" {...props} />;
}
