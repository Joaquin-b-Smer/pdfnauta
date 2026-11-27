import { PDF_TOOLS } from "@/lib/tools";
import { ToolPageClient } from "./tool-page-client";

export const dynamicParams = false;

export function generateStaticParams() {
  return PDF_TOOLS.map((tool) => ({ slug: tool.slug }));
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ToolPageClient slug={slug} />;
}
