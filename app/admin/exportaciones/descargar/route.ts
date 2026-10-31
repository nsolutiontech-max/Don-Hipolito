import { NextRequest, NextResponse } from "next/server";
import { exigirDueno } from "@/lib/data";
import { generateExportPDF, ExportOptions } from "@/lib/exports";

type ExportType =
  | ExportOptions["type"]
  | "TAREAS_DIARIA"
  | "TAREAS_SEMANAL";

export async function GET(request: NextRequest) {
  try {
    await exigirDueno();
  } catch {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const fecha = searchParams.get("fecha");
  const entrevistaId = searchParams.get("entrevista_id");

  if (!tipo) return new NextResponse("Tipo requerido", { status: 400 });

  const validTypes: ExportType[] = [
    "STOCK_A", "STOCK_B", "STOCK_C", "BEBIDAS",
    "TAREAS_DIARIA", "TAREAS_SEMANAL", "AUDITORIA", "ENTREVISTA",
  ];
  if (!validTypes.includes(tipo as ExportType)) return new NextResponse("Tipo inválido", { status: 400 });

  const baseOptions: ExportOptions = {
    type: tipo as ExportOptions["type"],
    date: fecha ?? new Date().toISOString().slice(0, 10),
    interviewId: entrevistaId ?? undefined,
    isWeekly: tipo === "TAREAS_SEMANAL",
  };

  try {
    const { buffer, filename } = await generateExportPDF(baseOptions);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generando PDF:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Error generando PDF",
      { status: 500 }
    );
  }
}