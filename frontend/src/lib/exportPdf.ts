import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/** Exports the given element as a downloaded PDF, pixel-matched to what's on screen. */
export async function exportElementToPdf(elementId: string, filename: string) {
    const target = document.getElementById(elementId);
    if (!target) return;

    const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imageData = canvas.toDataURL("image/jpeg", 0.98);

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imageData, "JPEG", 0, position, pageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "JPEG", 0, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
