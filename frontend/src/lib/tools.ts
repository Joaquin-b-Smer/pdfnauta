export type ToolCategory =
  | "todas"
  | "convertir"
  | "organizar"
  | "optimizar"
  | "seguridad";

export type ToolExecution = "local" | "server";

export type ToolIconName =
  | "merge"
  | "split"
  | "organize"
  | "images"
  | "signature"
  | "watermark"
  | "lock"
  | "pdf-word"
  | "pdf-excel"
  | "compress";

export interface PdfToolMeta {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  pageSubtitle?: string;
  category: Exclude<ToolCategory, "todas">;
  execution: ToolExecution;
  icon: ToolIconName;
  accept: string;
  acceptLabel: string;
  supportsPdfSmartDrop: boolean;
  highlights: string[];
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "convertir", label: "Convertir" },
  { id: "organizar", label: "Organizar" },
  { id: "optimizar", label: "Optimizar" },
  { id: "seguridad", label: "Seguridad" },
];

export const PDF_TOOLS: PdfToolMeta[] = [
  {
    slug: "unir-pdf",
    title: "Unir PDF",
    shortTitle: "Unir",
    description:
      "Combina múltiples archivos PDF en un solo documento con vista previa de portadas y reordenamiento libre.",
    category: "organizar",
    execution: "local",
    icon: "merge",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivos PDF",
    supportsPdfSmartDrop: true,
    highlights: ["Miniaturas en tiempo real", "Arrastrar y soltar", "Sin subir archivos"],
  },
  {
    slug: "separar-pdf",
    title: "Separar PDF",
    shortTitle: "Separar",
    description:
      "Extrae rangos específicos (ej. 1-3, 5, 8-10) o divide cada página en archivos individuales en un .zip.",
    category: "organizar",
    execution: "local",
    icon: "split",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF",
    supportsPdfSmartDrop: true,
    highlights: ["Rangos personalizados", "Descarga en .zip", "Instantáneo"],
  },
  {
    slug: "organizar-paginas",
    title: "Organizar y Editar Páginas",
    shortTitle: "Organizar",
    description:
      "Visualiza todas las páginas en cuadrícula para rotar 90°, eliminar, duplicar o cambiar su orden.",
    category: "organizar",
    execution: "local",
    icon: "organize",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF",
    supportsPdfSmartDrop: true,
    highlights: ["Rotación individual", "Duplicar y eliminar", "Reordenar con drag-and-drop"],
  },
  {
    slug: "pdf-imagenes",
    title: "PDF a JPG / PNG y viceversa",
    shortTitle: "PDF ↔ Imágenes",
    description:
      "Exporta páginas de un PDF como imágenes de alta nitidez (.zip) o une JPG, PNG y WebP en un PDF.",
    category: "convertir",
    execution: "local",
    icon: "images",
    accept: ".pdf,image/jpeg,image/png,image/webp",
    acceptLabel: "PDF o Imágenes (JPG, PNG, WebP)",
    supportsPdfSmartDrop: true,
    highlights: ["Alta resolución", "Márgenes y orientación", "Soporte JPG, PNG y WebP"],
  },
  {
    slug: "firmar-pdf",
    title: "Firmar PDF",
    shortTitle: "Firmar",
    description:
      "Dibuja tu firma, escríbela con estilo caligráfico o sube un PNG transparente y ubícala libremente.",
    category: "seguridad",
    execution: "local",
    icon: "signature",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF",
    supportsPdfSmartDrop: true,
    highlights: ["Dibujo, texto o imagen", "Redimensionado visual", "Múltiples páginas"],
  },
  {
    slug: "marca-agua-numeracion",
    title: "Marca de Agua y Numeración",
    shortTitle: "Marca y Números",
    description:
      "Añade texto de marca de agua o numeración (Página X de Y) ajustando opacidad, color, tamaño y posición.",
    category: "organizar",
    execution: "local",
    icon: "watermark",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF",
    supportsPdfSmartDrop: true,
    highlights: ["Vista previa interactiva", "Página X de Y", "Control de opacidad y posición"],
  },
  {
    slug: "proteger-desbloquear",
    title: "Proteger y Desbloquear PDF",
    shortTitle: "Proteger / Abrir",
    description:
      "Cifra tus PDF con contraseña para proteger su acceso o quita la clave de tus propios documentos.",
    category: "seguridad",
    execution: "local",
    icon: "lock",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF",
    supportsPdfSmartDrop: true,
    highlights: ["Cifrado en navegador", "Quitar contraseña propia", "Cero envío a servidores"],
  },
  {
    slug: "pdf-a-word",
    title: "PDF a Word (.docx)",
    shortTitle: "PDF a Word",
    description:
      "Conversión fiel preservando tablas, columnas, fuentes e imágenes, con OCR opcional para escaneos.",
    category: "convertir",
    execution: "server",
    icon: "pdf-word",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF (máx. 20 MB)",
    supportsPdfSmartDrop: true,
    highlights: ["Preserva tablas e imágenes", "OCR para escaneados", "Motor Python de precisión"],
  },
  {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    shortTitle: "PDF to Excel",
    description:
      "Extraé las tablas de tu PDF y descargalas en Excel para editar",
    pageSubtitle:
      "Subí tu PDF con tablas y descargalo en Excel listo para editar. 100% gratis y sin registro.",
    category: "convertir",
    execution: "local",
    icon: "pdf-excel",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF (máx. 10 MB)",
    supportsPdfSmartDrop: true,
    highlights: ["Vista previa de tabla", "Exportación .xlsx", "100% en tu navegador"],
  },
  {
    slug: "comprimir-pdf",
    title: "Comprimir PDF",
    shortTitle: "Comprimir",
    description:
      "Reduce el peso de tus PDF eligiendo entre 3 niveles (Extrema, Recomendada, Baja) con ahorro visible.",
    category: "optimizar",
    execution: "server",
    icon: "compress",
    accept: ".pdf,application/pdf",
    acceptLabel: "Archivo PDF (máx. 20 MB)",
    supportsPdfSmartDrop: true,
    highlights: ["3 niveles de compresión", "Porcentaje de ahorro", "Optimización inteligente"],
  },
];

export function getToolBySlug(slug: string): PdfToolMeta | undefined {
  return PDF_TOOLS.find((t) => t.slug === slug);
}
