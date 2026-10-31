import "server-only";
import PDFDocument from "pdfkit";
import { supabaseServer } from "@/lib/supabase/server";
import { displayDate, fechaHoy } from "@/lib/dates";
import { getInventoryCatalog, getInventory } from "@/lib/data";
import { getAudit } from "@/lib/audits";
import { getInterview } from "@/lib/interviews";
import { getTasks, getWeekSummary } from "@/lib/tasks";
import type { SheetCode } from "@/lib/types";

type ExportType =
  | "STOCK_A" | "STOCK_B" | "STOCK_C" | "BEBIDAS"
  | "TAREAS_DIARIA" | "TAREAS_SEMANAL" | "AUDITORIA" | "ENTREVISTA";

export interface ExportOptions {
  type: ExportType;
  date: string;
  sheetCode?: SheetCode;
  interviewId?: string;
  isWeekly?: boolean;
}

const MARGIN = 36;
const FONT_NORMAL = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

function createDoc(landscape = false) {
  const size = landscape ? [841.89, 595.28] : [595.28, 841.89];
  return new PDFDocument({
    size: size as [number, number],
    margin: MARGIN,
    autoFirstPage: false,
  });
}

function addHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.font(FONT_BOLD).fontSize(16).text(title, MARGIN, MARGIN, { align: "center" });
  doc.font(FONT_NORMAL).fontSize(10).fillColor("#666666").text(subtitle, MARGIN, MARGIN + 22, { align: "center" });
  doc.fillColor("black");
  doc.moveTo(MARGIN, MARGIN + 36).lineTo(doc.page.width - MARGIN, MARGIN + 36).strokeColor("#047857").lineWidth(1).stroke();
}

function addFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  const bottom = doc.page.height - MARGIN + 10;
  doc.font(FONT_NORMAL).fontSize(8).fillColor("#999999").text(
    `Don Hipólito · ${displayDate(fechaHoy())} · Página ${pageNum} de ${totalPages}`,
    MARGIN,
    bottom,
    { align: "center", width: doc.page.width - 2 * MARGIN }
  );
  doc.fillColor("black");
}

async function exportStockPDF(options: ExportOptions): Promise<Buffer> {
  const { type, date, sheetCode } = options;
  const code = sheetCode ?? (type as SheetCode);
  const catalog = await getInventoryCatalog(code);
  if (!catalog) throw new Error("Planilla no encontrada");
  const { inventory, details } = await getInventory(catalog.sheet.id, date);

  const isBeverages = catalog.sheet.modo === "STOCK_UBICACIONES";
  const doc = createDoc(false);
  const buffers: Buffer[] = [];

  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {});

  doc.addPage();
  addHeader(doc, catalog.sheet.nombre, `Inventario del ${displayDate(date)} · ${inventory?.estado ?? "SIN INICIAR"}`);

  let y = MARGIN + 50;
  const colWidths = isBeverages ? [240, 80, 80, 80, 80] : [280, 80, 80, 120];
  const headers = isBeverages ? ["Artículo", "Depósito", "Heladera", "Total", "Pedir"] : ["Artículo", "Stock", "Pedir", "Observaciones"];

  function drawTableHeader() {
    doc.font(FONT_BOLD).fontSize(9);
    let x = MARGIN;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i], align: i === 0 ? "left" : "center" });
      x += colWidths[i];
    });
    doc.moveTo(MARGIN, y + 16).lineTo(doc.page.width - MARGIN, y + 16).strokeColor("#047857").lineWidth(0.5).stroke();
    y += 20;
  }

  drawTableHeader();

  for (const section of catalog.sections) {
    const products = catalog.products.filter(p => p.seccion_id === section.id);
    if (!products.length) continue;

    if (y > doc.page.height - MARGIN - 80) {
      doc.addPage();
      y = MARGIN;
      addHeader(doc, catalog.sheet.nombre, `Inventario del ${displayDate(date)} (continuación)`);
      drawTableHeader();
    }

    doc.font(FONT_BOLD).fontSize(10).text(section.nombre, MARGIN, y);
    y += 16;

    for (const product of products) {
      if (y > doc.page.height - MARGIN - 40) {
        doc.addPage();
        y = MARGIN;
        drawTableHeader();
      }

      const dep = details.find(d => d.producto_id === product.id && d.ubicacion === "DEPOSITO");
      const hel = details.find(d => d.producto_id === product.id && d.ubicacion === "HELADERA");
      const gen = details.find(d => d.producto_id === product.id && d.ubicacion === "GENERAL");

      const depVal = dep?.stock_real ?? null;
      const helVal = hel?.stock_real ?? null;
      const genVal = gen?.stock_real ?? null;
      const pedidoVal = isBeverages ? null : (gen?.cantidad_pedida ?? null);
      const totalVal = isBeverages
        ? (depVal !== null && helVal !== null ? depVal + helVal : null)
        : genVal;

      doc.font(FONT_NORMAL).fontSize(9);
      let x = MARGIN;
      doc.text(product.nombre + (product.presentacion ? ` · ${product.presentacion}` : ""), x, y, { width: colWidths[0] });
      x += colWidths[0];

      if (isBeverages) {
        doc.text(depVal === null ? "—" : depVal.toString(), x, y, { width: colWidths[1], align: "center" });
        x += colWidths[1];
        doc.text(helVal === null ? "—" : helVal.toString(), x, y, { width: colWidths[2], align: "center" });
        x += colWidths[2];
        doc.text(totalVal === null ? "—" : totalVal.toString(), x, y, { width: colWidths[3], align: "center" });
        x += colWidths[3];
        doc.text(pedidoVal === null ? "—" : pedidoVal.toString(), x, y, { width: colWidths[4], align: "center" });
      } else {
        doc.text(genVal === null ? "—" : genVal.toString(), x, y, { width: colWidths[1], align: "center" });
        x += colWidths[1];
        doc.text(pedidoVal === null ? "—" : pedidoVal.toString(), x, y, { width: colWidths[2], align: "center" });
        x += colWidths[2];
        doc.text(inventory?.observaciones?.slice(0, 30) ?? "—", x, y, { width: colWidths[3] });
      }

      y += 14;
    }
    y += 6;
  }

  if (inventory?.observaciones) {
    if (y > doc.page.height - MARGIN - 60) doc.addPage();
    doc.font(FONT_BOLD).fontSize(10).text("Observaciones:", MARGIN, y);
    y += 16;
    doc.font(FONT_NORMAL).fontSize(9).text(inventory.observaciones, MARGIN, y, { width: doc.page.width - 2 * MARGIN });
  }

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, totalPages);
  }

  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

async function exportTasksPDF(options: ExportOptions): Promise<Buffer> {
  const { date, isWeekly } = options;
  const doc = createDoc(false);
  const buffers: Buffer[] = [];

  doc.on("data", buffers.push.bind(buffers));

  if (isWeekly) {
    const { weekStart, weekEnd, areas } = await getWeekSummary(date);
    doc.addPage();
    addHeader(doc, "Resumen semanal de tareas", `Semana del ${displayDate(weekStart)} al ${displayDate(weekEnd)}`);

    let y = MARGIN + 50;
    for (const area of areas) {
      if (y > doc.page.height - MARGIN - 120) {
        doc.addPage();
        y = MARGIN;
        addHeader(doc, "Resumen semanal de tareas (continuación)", `Semana del ${displayDate(weekStart)} al ${displayDate(weekEnd)}`);
      }

      doc.font(FONT_BOLD).fontSize(12).text(area.nombre, MARGIN, y);
      y += 20;

      const colWidths = [80, 60, 60, 60, 60, 60, 60, 60];
      const dayHeaders = ["Día", ...["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]];

      doc.font(FONT_BOLD).fontSize(9);
      let x = MARGIN;
      dayHeaders.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: "center" });
        x += colWidths[i];
      });
      y += 14;
      doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor("#047857").lineWidth(0.5).stroke();
      y += 4;

      for (let i = 0; i < 7; i++) {
        const day = area.dias[i];
        doc.font(FONT_NORMAL).fontSize(9);
        x = MARGIN;
        doc.text(displayDate(day.fecha).split("/")[0], x, y, { width: colWidths[0], align: "center" });
        x += colWidths[0];
        doc.text(`${day.hechas}/${day.total}`, x, y, { width: colWidths[i + 1], align: "center" });
        x += colWidths[i + 1];
        y += 14;
      }

      y += 6;
      doc.font(FONT_BOLD).fontSize(9).text(`Semanal: ${area.semanal.hechas}/${area.semanal.total}`, MARGIN, y);
      y += 14;
      if (area.opcional.total) {
        doc.font(FONT_NORMAL).fontSize(9).text(`Según necesidad: ${area.opcional.hechas}/${area.opcional.total}`, MARGIN, y);
        y += 14;
      }
      y += 10;
    }
  } else {
    const { tasks, records, weekStart, weekEnd } = await getTasks("COCINA", date);
    const { tasks: tasksSalon, records: recordsSalon } = await getTasks("SALON", date);

    doc.addPage();
    addHeader(doc, "Tareas del día", `${displayDate(date)} (semana ${displayDate(weekStart)}–${displayDate(weekEnd)})`);

    let y = MARGIN + 50;

    for (const [area, tasksArea, recordsArea] of [
      ["Cocina", tasks, records],
      ["Salón", tasksSalon, recordsSalon],
    ] as const) {
      const areaRecords = recordsArea.filter(r => r.fecha === date);
      if (y > doc.page.height - MARGIN - 80) {
        doc.addPage();
        y = MARGIN;
        addHeader(doc, "Tareas del día (continuación)", `${displayDate(date)}`);
      }

      doc.font(FONT_BOLD).fontSize(12).text(area, MARGIN, y);
      y += 20;

      const colWidths = [40, 280, 80, 120];
      const headers = ["#", "Tarea", "Hora ref.", "Nota"];

      doc.font(FONT_BOLD).fontSize(9);
      let x = MARGIN;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: i === 0 || i === 2 ? "center" : "left" });
        x += colWidths[i];
      });
      y += 14;
      doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor("#047857").lineWidth(0.5).stroke();
      y += 4;

      for (let i = 0; i < tasksArea.length; i++) {
        const task = tasksArea[i];
        const record = areaRecords.find(r => r.programacion_id === task.id);
        if (y > doc.page.height - MARGIN - 30) {
          doc.addPage();
          y = MARGIN;
        }

        doc.font(FONT_NORMAL).fontSize(9);
        x = MARGIN;
        doc.text(String(i + 1), x, y, { width: colWidths[0], align: "center" });
        x += colWidths[0];
        doc.text(task.actividades.nombre, x, y, { width: colWidths[1] });
        x += colWidths[1];
        doc.text(task.hora_objetivo ?? "—", x, y, { width: colWidths[2], align: "center" });
        x += colWidths[2];
        doc.text(record?.nota ?? "—", x, y, { width: colWidths[3] });
        y += 14;
      }
      y += 10;
    }
  }

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, totalPages);
  }

  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

async function exportAuditPDF(options: ExportOptions): Promise<Buffer> {
  const { date } = options;
  const { audit, parts, responses } = await getAudit(date);
  if (!audit) throw new Error("Auditoría no encontrada para esa fecha");

  const { items } = await getAuditTemplate();
  // template loaded for reference; criteria from audit are used directly

  const doc = createDoc(true); // landscape
  const buffers: Buffer[] = [];

  doc.on("data", buffers.push.bind(buffers));

  doc.addPage();
  addHeader(doc, "Auditoría Diaria", `${displayDate(date)} · ${audit.estado} · Auditor: ${parts[0]?.usuarios?.email ?? "—"}`);

  let y = MARGIN + 50;

  // Resumen
  const okCount = responses.filter(r => r.resultado === "OK").length;
  const noOkCount = responses.filter(r => r.resultado === "NO_OK").length;
  const pendCount = responses.filter(r => r.resultado === null).length;

  doc.font(FONT_BOLD).fontSize(10).text(`Resumen: ${okCount} OK · ${noOkCount} NO OK · ${pendCount} Pendientes`, MARGIN, y);
  if (audit.firma) {
    doc.font(FONT_NORMAL).fontSize(9).text(`Firma: ${audit.firma}`, MARGIN + 300, y);
  }
  y += 20;

  if (audit.observaciones_generales) {
    doc.font(FONT_BOLD).fontSize(10).text("Observaciones generales:", MARGIN, y);
    y += 14;
    doc.font(FONT_NORMAL).fontSize(9).text(audit.observaciones_generales, MARGIN, y, { width: doc.page.width - 2 * MARGIN });
    y += 20;
  }

  const colWidths = [40, 380, 60, 60, 60, 60];
  const headers = ["#", "Criterio", "Resultado", "Obs.", "Mejora", "Necesidad"];

  function drawTableHeader() {
    doc.font(FONT_BOLD).fontSize(8);
    let x = MARGIN;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i], align: i === 0 || i === 2 ? "center" : "left" });
      x += colWidths[i];
    });
    y += 12;
    doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor("#047857").lineWidth(0.5).stroke();
    y += 4;
  }

  drawTableHeader();

  const cocinaItems = items.filter(i => i.bloque === "COCINA");
  const salonItems = items.filter(i => i.bloque === "SALON_GENERAL");

  for (const [blockName, blockItems] of [["COCINA", cocinaItems], ["SALÓN / GENERAL", salonItems]] as const) {
    if (!blockItems.length) continue;

    if (y > doc.page.height - MARGIN - 60) {
      doc.addPage();
      y = MARGIN;
      addHeader(doc, "Auditoría Diaria (continuación)", `${displayDate(date)}`);
      drawTableHeader();
    }

    doc.font(FONT_BOLD).fontSize(10).fillColor("#047857").text(blockName, MARGIN, y);
    doc.fillColor("black");
    y += 16;

    for (let i = 0; i < blockItems.length; i++) {
      const item = blockItems[i];
      const response = responses.find(r => r.item_id === item.id);

      if (y > doc.page.height - MARGIN - 30) {
        doc.addPage();
        y = MARGIN;
        drawTableHeader();
      }

      doc.font(FONT_NORMAL).fontSize(8);
      let x = MARGIN;
      doc.text(String(i + 1), x, y, { width: colWidths[0], align: "center" });
      x += colWidths[0];
      doc.text(item.texto, x, y, { width: colWidths[1] });
      x += colWidths[1];
      const result = response?.resultado ?? "—";
      doc.text(result === "—" ? "—" : result, x, y, { width: colWidths[2], align: "center" });
      x += colWidths[2];
      doc.text(response?.observaciones?.slice(0, 15) ?? "—", x, y, { width: colWidths[3], align: "center" });
      x += colWidths[3];
      doc.text(response?.mejora?.slice(0, 15) ?? "—", x, y, { width: colWidths[4], align: "center" });
      x += colWidths[4];
      doc.text(response?.necesidad?.slice(0, 15) ?? "—", x, y, { width: colWidths[5], align: "center" });
      y += 12;
    }
    y += 6;
  }

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, totalPages);
  }

  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

async function exportInterviewPDF(options: ExportOptions): Promise<Buffer> {
  const { interviewId } = options;
  if (!interviewId) throw new Error("ID de entrevista requerido");

  const { interview, sections, criteria, sectionResponses, criterionResponses } = await getInterview(interviewId);
  if (!interview) throw new Error("Entrevista no encontrada");

  await getInterviewTemplate(); // reference only

  const doc = createDoc(false);
  const buffers: Buffer[] = [];

  doc.on("data", buffers.push.bind(buffers));

  doc.addPage();
  addHeader(doc, "Entrevista Práctica", `${interview.candidato} · ${interview.puesto_aspira} · ${displayDate(interview.fecha)} · ${interview.estado}`);

  let y = MARGIN + 50;

  // Datos del candidato
  doc.font(FONT_BOLD).fontSize(10).text("Datos del candidato", MARGIN, y);
  y += 16;
  doc.font(FONT_NORMAL).fontSize(9);
  const fields = [
    ["Candidato", interview.candidato],
    ["Puesto al que aspira", interview.puesto_aspira],
    ["Fecha", displayDate(interview.fecha)],
    ["Estado", interview.estado],
    ["Decisión", interview.decision ?? "Pendiente"],
    ["Puesto sugerido", interview.puesto_sugerido ?? "—"],
  ];
  for (const [label, value] of fields) {
    doc.font(FONT_BOLD).text(`${label}: `, MARGIN, y, { continued: true });
    doc.font(FONT_NORMAL).text(value, { width: 300 });
    y += 14;
  }
  y += 10;

  // Respuestas por sección
  for (const section of sections) {
    if (y > doc.page.height - MARGIN - 80) {
      doc.addPage();
      y = MARGIN;
      addHeader(doc, "Entrevista Práctica (continuación)", `${interview.candidato} · ${displayDate(interview.fecha)}`);
    }

    doc.font(FONT_BOLD).fontSize(11).fillColor("#047857").text(section.titulo, MARGIN, y);
    doc.fillColor("black");
    if (section.instruccion) {
      doc.font(FONT_NORMAL).fontSize(8).fillColor("gray").text(section.instruccion, MARGIN, y + 16, { width: doc.page.width - 2 * MARGIN });
      y += 30;
    } else {
      y += 20;
    }

    const sectionCrit = criteria.filter(c => c.seccion_id === section.id);
    const secResponse = sectionResponses.find(r => r.seccion_id === section.id);

    doc.font(FONT_BOLD).fontSize(9).text(`Resultado sección: ${secResponse?.resultado ?? "Pendiente"}`, MARGIN, y);
    if (secResponse?.observaciones) {
      doc.font(FONT_NORMAL).fontSize(8).text(`Obs: ${secResponse.observaciones}`, MARGIN + 200, y, { width: 250 });
    }
    y += 18;

    for (const crit of sectionCrit) {
      if (y > doc.page.height - MARGIN - 30) {
        doc.addPage();
        y = MARGIN;
      }

      const critResponse = criterionResponses.find(r => r.criterio_id === crit.id);
      doc.font(FONT_NORMAL).fontSize(9);
      const check = critResponse?.valor === true ? "☑" : critResponse?.valor === false ? "☐" : "○";
      doc.text(`${check} ${crit.texto}`, MARGIN + 10, y, { width: doc.page.width - 2 * MARGIN - 20 });
      if (critResponse?.observacion) {
        y += 14;
        doc.font(FONT_NORMAL).fontSize(8).fillColor("gray").text(`  → ${critResponse.observacion}`, MARGIN + 10, y, { width: doc.page.width - 2 * MARGIN - 20 });
        doc.fillColor("black");
      }
      y += 14;
    }
    y += 8;
  }

  // Valoraciones finales
  if (y > doc.page.height - MARGIN - 100) {
    doc.addPage();
    y = MARGIN;
    addHeader(doc, "Entrevista Práctica (continuación)", `${interview.candidato} · ${displayDate(interview.fecha)}`);
  }

  doc.font(FONT_BOLD).fontSize(11).fillColor("#047857").text("Valoraciones finales (1–5)", MARGIN, y);
  doc.fillColor("black");
  y += 18;

  const ratings = [
    ["Técnica actual", interview.tecnica_actual],
    ["Velocidad", interview.velocidad],
    ["Prolijidad", interview.prolijidad],
    ["Capacidad de aprendizaje", interview.capacidad_aprendizaje],
    ["Actitud", interview.actitud],
  ];
  for (const [label, value] of ratings) {
    doc.font(FONT_BOLD).fontSize(9).text(`${label}: `, MARGIN, y, { continued: true });
    doc.font(FONT_NORMAL).text(value?.toString() ?? "—", { width: 100 });
    y += 14;
  }
  y += 10;

  // Decisión y observaciones finales
  doc.font(FONT_BOLD).fontSize(11).fillColor("#047857").text("Decisión final", MARGIN, y);
  doc.fillColor("black");
  y += 18;
  doc.font(FONT_BOLD).fontSize(10).text(`Decisión: ${interview.decision ?? "Sin decisión"}`, MARGIN, y);
  y += 16;
  doc.font(FONT_BOLD).fontSize(10).text(`Puesto sugerido: ${interview.puesto_sugerido ?? "—"}`, MARGIN, y);
  y += 16;
  if (interview.observaciones_finales) {
    doc.font(FONT_BOLD).fontSize(10).text("Observaciones finales:", MARGIN, y);
    y += 16;
    doc.font(FONT_NORMAL).fontSize(9).text(interview.observaciones_finales, MARGIN, y, { width: doc.page.width - 2 * MARGIN });
  }

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, totalPages);
  }

  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

async function getAuditTemplate() {
  const db = await supabaseServer();
  const template = await db.from("auditoria_plantillas")
    .select("id,codigo,nombre,version").eq("codigo", "AUDITORIA_2026").eq("activa", true).single();
  if (template.error) throw new Error("No se pudo cargar la plantilla de auditoría.");
  const items = await db.from("auditoria_items").select("*").eq("plantilla_id", template.data.id).order("orden");
  if (items.error) throw new Error("No se pudieron cargar los criterios de auditoría.");
  return { template: template.data, items: items.data };
}

async function getInterviewTemplate() {
  const db = await supabaseServer();
  const template = await db.from("entrevista_plantillas")
    .select("id,codigo,nombre,version").eq("codigo", "ENTREVISTA_PRACTICA").eq("activa", true).single();
  if (template.error) throw new Error("No se pudo cargar la plantilla de entrevistas.");
  const [sections, criteria] = await Promise.all([
    db.from("entrevista_secciones").select("*").eq("plantilla_id", template.data.id).order("orden"),
    db.from("entrevista_criterios").select("*").eq("plantilla_id", template.data.id).order("orden"),
  ]);
  if (sections.error || criteria.error) throw new Error("No se pudo cargar la evaluación práctica.");
  return { template: template.data, sections: sections.data, criteria: criteria.data };
}

export async function generateExportPDF(options: ExportOptions): Promise<{ buffer: Buffer; filename: string }> {
  let buffer: Buffer;
  let filename: string;

  switch (options.type) {
    case "STOCK_A":
    case "STOCK_B":
    case "STOCK_C":
    case "BEBIDAS":
      buffer = await exportStockPDF(options);
      filename = `${options.type}_${options.date}.pdf`;
      break;
    case "TAREAS_DIARIA":
    case "TAREAS_SEMANAL":
      buffer = await exportTasksPDF(options);
      filename = `TAREAS_${options.isWeekly ? "SEMANAL_" : "DIARIA_"}${options.date}.pdf`;
      break;
    case "AUDITORIA":
      buffer = await exportAuditPDF(options);
      filename = `AUDITORIA_${options.date}.pdf`;
      break;
    case "ENTREVISTA":
      buffer = await exportInterviewPDF(options);
      filename = `ENTREVISTA_${options.interviewId ?? options.date}.pdf`;
      break;
    default:
      throw new Error(`Tipo de exportación no soportado: ${options.type}`);
  }

  return { buffer, filename };
}