import { BookQuoteSpinner } from "@/components/layout/BookQuoteSpinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDown } from "lucide-react";
import { useState } from "react";

export default function PdfCatalogCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report/pdfcatalog");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalog_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-cy="pdf-catalog-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileDown className="w-5 h-5 text-primary" />
          Catalog
        </CardTitle>
        <CardDescription>Full catalog as PDF</CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <BookQuoteSpinner />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Generates a complete book catalog with covers as a
              PDF document.
            </p>
            <Button
              onClick={handleDownload}
              data-cy="pdf-catalog-download-button"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Catalog herunterladen
            </Button>
            {error && (
              <p className="text-sm text-destructive">Error: {error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
