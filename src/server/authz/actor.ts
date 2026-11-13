// Actor de la petición: lo produce getActor() (E1-T5) a partir de la sesión y lo consume can().
export type RolStaff = "asesor" | "coordinador" | "gerencia" | "admin";

export type ActorStaff = {
  tipo: "staff";
  userId: string;
  staffId: string;
  rol: RolStaff;
  email: string;
};

export type ActorCliente = {
  tipo: "cliente";
  userId: string;
  clienteId: string | null;
  email: string;
  consentimiento: boolean;
};

export type Actor = ActorStaff | ActorCliente;
