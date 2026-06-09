"use client";

import { MeshProvider } from "@/providers/MeshProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MeshProvider>{children}</MeshProvider>;
}
