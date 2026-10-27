import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { pageSession } from "@/lib/data";
import { getInterview } from "@/lib/interviews";
import { InterviewClient } from "@/components/interviews/InterviewClient";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await pageSession();
  if (session.rol !== "DUEÑO") redirect("/hoy");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await getInterview(id);
  if (!data.interview) notFound();
  return <InterviewClient key={`${data.interview.id}:${data.interview.actualizado_en}`} data={data} evaluatorName={session.responsable_nombre ?? session.email} />;
}
