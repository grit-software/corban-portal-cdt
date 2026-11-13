"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Barras del total invertido por entidad. La tabla equivalente va debajo en la página (accesibilidad).
export function BarrasInversion({ datos }: { datos: { nombre: string; total: number }[] }) {
  return (
    <div className="h-64 w-full text-primary motion-reduce:transition-none" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
          <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="total" fill="currentColor" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
