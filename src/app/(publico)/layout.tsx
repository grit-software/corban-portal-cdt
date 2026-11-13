import type { ReactNode } from "react";
import { ShellPublico } from "@/components/shell/shell-publico";

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return <ShellPublico>{children}</ShellPublico>;
}
