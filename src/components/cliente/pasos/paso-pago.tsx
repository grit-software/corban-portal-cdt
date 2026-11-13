"use client";

import type { ComponentProps } from "react";
import { FormularioPaso } from "../formulario-paso.tsx";

// Paso «pago» del asistente: el formulario genérico con la configuración de ese paso.
export function PasoPago(props: Omit<ComponentProps<typeof FormularioPaso>, "paso">) {
  return <FormularioPaso paso="pago" {...props} />;
}
