import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSesionUsuario } from "@/lib/data";

export default async function LoginPage() {
  const sesion = await getSesionUsuario();
  if (sesion) redirect("/conteo/hoy");
  return <LoginForm />;
}
