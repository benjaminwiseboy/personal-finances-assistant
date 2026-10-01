import { redirect } from "next/navigation";
import { getUserId } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getUserId())) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
