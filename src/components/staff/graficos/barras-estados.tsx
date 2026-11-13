"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Barras de solicitudes por estado. La tabla equivalente va debajo en la página (accesibilidad).
export function BarrasEstados({ datos }: { datos: { estado: string; cantidad: number }[] }) {
  return (
    <div className="h-64 w-full text-primary motion-reduce:transition-none" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
          <XAxis dataKey="estado" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="cantidad" fill="currentColor" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
