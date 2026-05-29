import {
  checkCoverExists,
  fetchBookDataByIsbn,
  uploadCover,
} from "@/components/batch-scan";
import Layout from "@/components/layout/Layout";
import { t } from "@/lib/i18n";
import { currentTime } from "@/lib/utils/dateutils";
import {
  ArrowLeft,
  BookPlus,
  CheckCircle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  isbn: string;
  quantity: number;
}

interface ColumnInfo {
  index: number;
  header: string;
  sample: string[];
  isbnScore: number; // fraction of non-empty values that look like ISBNs
  isQtyCandidate: boolean;
}

interface ImportResult {
  recordsCreated: number;
  failed: string[];
  skipped: number;
}

type ImportState = "idle" | "column-pick" | "preview" | "importing" | "done";

// ─── CSV template ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE = `isbn,quantity,notes
9780385490818,1,Good condition
9780316769174,2,Two library copies
9783746629612,1,
`;

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function isbnLike(value: string): boolean {
  const cleaned = value.replace(/[-\s]/g, "");
  return /^\d{9,13}[\dXx]?$/.test(cleaned);
}

function cleanIsbn(value: string): string {
  return value.replace(/[-\s]/g, "");
}

function scoreColumn(values: string[]): number {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  if (nonEmpty.length === 0) return 0;
  return nonEmpty.filter((v) => isbnLike(v)).length / nonEmpty.length;
}

function isQtyHeader(header: string): boolean {
  return /qty|quantity|anzahl|copies|exemplar|count|menge/i.test(header);
}

/** Parse a raw text file — one value per line. */
function parseTxt(text: string): { headers: string[]; rows: string[][] } {
  const rows = text
    .split("\n")
    .map((l) => [l.trim()])
    .filter(([v]) => v !== "");
  return { headers: [], rows };
}

/** Parse a CSV string into headers + rows (handles quoted fields). */
function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const firstRow = parseRow(lines[0]);
  // Detect header row: if any cell looks like an ISBN, treat entire file as no-header
  const hasHeaders = !firstRow.some((v) => isbnLike(v));

  if (hasHeaders) {
    const headers = firstRow;
    const rows = lines
      .slice(1)
      .map(parseRow)
      .filter((r) => r.some((v) => v !== ""));
    return { headers, rows };
  }

  const rows = lines.map(parseRow).filter((r) => r.some((v) => v !== ""));
  return { headers: [], rows };
}

/** Parse an xlsx/xls binary into headers + rows. */
function parseXlsx(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as unknown[][];
  if (raw.length === 0) return { headers: [], rows: [] };

  const stringify = (v: unknown) => (v == null ? "" : String(v).trim());
  const firstRow = raw[0].map(stringify);
  const hasHeaders = !firstRow.some((v) => isbnLike(v));

  if (hasHeaders) {
    const headers = firstRow;
    const rows = raw
      .slice(1)
      .map((r) => r.map(stringify))
      .filter((r) => r.some((v) => v !== ""));
    return { headers, rows };
  }

  const rows = raw.map((r) => r.map(stringify)).filter((r) => r.some((v) => v !== ""));
  return { headers: [], rows };
}

// ─── Column detection ─────────────────────────────────────────────────────────

function detectColumns(
  headers: string[],
  rows: string[][],
): {
  columns: ColumnInfo[];
  autoIsbnIdx: number; // -1 if ambiguous
  autoQtyIdx: number;  // -1 if none found
  ambiguous: boolean;
} {
  if (rows.length === 0) {
    return { columns: [], autoIsbnIdx: 0, autoQtyIdx: -1, ambiguous: false };
  }

  const colCount = Math.max(...rows.map((r) => r.length));
  const columns: ColumnInfo[] = [];

  for (let i = 0; i < colCount; i++) {
    const header = headers[i] ?? `Column ${i + 1}`;
    const values = rows.map((r) => r[i] ?? "");
    const sample = values.slice(0, 3).filter((v) => v !== "");
    const isbnScore = scoreColumn(values);
    const isQtyCandidate =
      isQtyHeader(header) ||
      (isbnScore < 0.3 && values.every((v) => v === "" || /^\d{1,3}$/.test(v)));

    columns.push({ index: i, header, sample, isbnScore, isQtyCandidate });
  }

  // Single-column file: always the ISBN column
  if (columns.length === 1) {
    return { columns, autoIsbnIdx: 0, autoQtyIdx: -1, ambiguous: false };
  }

  const isbnCandidates = columns.filter((c) => c.isbnScore >= 0.5);
  const qtyCandidates = columns.filter((c) => c.isQtyCandidate && c.isbnScore < 0.3);
  const autoQtyIdx = qtyCandidates.length === 1 ? qtyCandidates[0].index : -1;

  if (isbnCandidates.length === 1) {
    return {
      columns,
      autoIsbnIdx: isbnCandidates[0].index,
      autoQtyIdx,
      ambiguous: false,
    };
  }

  // Ambiguous: pick highest-scoring as default but ask the user
  const best = [...columns].sort((a, b) => b.isbnScore - a.isbnScore)[0];
  return { columns, autoIsbnIdx: best.index, autoQtyIdx, ambiguous: true };
}

// ─── Build entries ────────────────────────────────────────────────────────────

function buildEntries(
  rows: string[][],
  isbnIdx: number,
  qtyIdx: number,
): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const raw = row[isbnIdx] ?? "";
    const isbn = cleanIsbn(raw);
    if (!isbnLike(isbn)) continue;
    if (seen.has(isbn)) continue;
    seen.add(isbn);

    const qtyRaw = qtyIdx >= 0 ? row[qtyIdx] : "";
    const qty = Math.min(Math.max(parseInt(qtyRaw) || 1, 1), 99);
    entries.push({ isbn, quantity: qty });
  }
  return entries;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>("idle");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"txt" | "csv" | "xlsx">("txt");

  // Column picker state
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [isbnColIdx, setIsbnColIdx] = useState(0);
  const [qtyColIdx, setQtyColIdx] = useState(-1);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);

  // Import state
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    let parsed: { headers: string[]; rows: string[][] };

    if (ext === "xlsx" || ext === "xls") {
      setFileType("xlsx");
      const buffer = await file.arrayBuffer();
      parsed = parseXlsx(buffer);
    } else if (ext === "csv") {
      setFileType("csv");
      const text = await file.text();
      parsed = parseCsvText(text);
    } else {
      setFileType("txt");
      const text = await file.text();
      parsed = parseTxt(text);
    }

    const { columns: cols, autoIsbnIdx, autoQtyIdx, ambiguous } =
      detectColumns(parsed.headers, parsed.rows);

    setParsedRows(parsed.rows);
    setParsedHeaders(parsed.headers);
    setColumns(cols);
    setIsbnColIdx(autoIsbnIdx);
    setQtyColIdx(autoQtyIdx);

    if (ambiguous) {
      setState("column-pick");
    } else {
      const built = buildEntries(parsed.rows, autoIsbnIdx, autoQtyIdx);
      setEntries(built);
      setState("preview");
    }
  }

  function confirmColumns() {
    const built = buildEntries(parsedRows, isbnColIdx, qtyColIdx);
    setEntries(built);
    setState("preview");
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function runImport() {
    setState("importing");
    const failed: string[] = [];
    let recordsCreated = 0;
    let skipped = 0;

    for (let i = 0; i < entries.length; i++) {
      const { isbn, quantity } = entries[i];
      setProgress(i + 1);

      const bookData = await fetchBookDataByIsbn(isbn);
      if (!bookData?.title) {
        failed.push(isbn);
        continue;
      }

      const bookBase = {
        title: bookData.title,
        subtitle: bookData.subtitle ?? "",
        author: bookData.author ?? "",
        renewalCount: 0,
        rentalStatus: "available",
        topics: bookData.topics ?? ";",
        rentedDate: currentTime(),
        dueDate: currentTime(),
        isbn: bookData.isbn ?? isbn,
        publisherName: bookData.publisherName,
        publisherLocation: bookData.publisherLocation,
        publisherDate: bookData.publisherDate,
        pages: bookData.pages,
        summary: bookData.summary,
        minAge: bookData.minAge,
        maxAge: bookData.maxAge,
        price: bookData.price,
        externalLinks: bookData.externalLinks,
        physicalSize: bookData.physicalSize,
        otherPhysicalAttributes: bookData.otherPhysicalAttributes,
        editionDescription: bookData.editionDescription,
      };

      // Fetch cover once per ISBN, reuse blob for all copies
      const coverResult = await checkCoverExists(isbn);

      for (let copy = 0; copy < quantity; copy++) {
        try {
          const res = await fetch("/api/book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookBase),
          });

          if (res.ok) {
            const created = await res.json();
            recordsCreated++;
            if (copy === 0 && coverResult.exists && coverResult.blob && created.id) {
              await uploadCover(created.id, coverResult.blob);
            }
          } else {
            const body = await res.json().catch(() => ({}));
            if (
              typeof body?.result === "string" &&
              body.result.includes("Unique constraint")
            ) {
              skipped++;
            } else {
              if (copy === 0) failed.push(isbn);
            }
          }
        } catch {
          if (copy === 0) failed.push(isbn);
        }
      }
    }

    setResult({ recordsCreated, failed, skipped });
    setState("done");
  }

  // ── Downloads ──────────────────────────────────────────────────────────────

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "isbn-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadFailed() {
    if (!result?.failed.length) return;
    const blob = new Blob([result.failed.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "failed-isbns.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const totalCopies = entries.reduce((sum, e) => sum + e.quantity, 0);
  const hasQuantities = entries.some((e) => e.quantity > 1);

  const FileIcon = fileType === "txt" ? FileText : FileSpreadsheet;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <Head>
        <title>{t("importPage.pageTitle")}</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("importPage.backButton")}
        </button>

        <h1 className="text-2xl font-bold text-foreground mb-1">
          {t("importPage.heading")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("importPage.subheading")}
        </p>

        {/* ── Upload card ─────────────────────────────────────────────────── */}
        {(state === "idle" || state === "column-pick" || state === "preview") && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("importPage.uploadLabel")}
            </label>
            <p className="text-xs text-muted-foreground mb-4">
              {t("importPage.uploadHint")}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t("importPage.uploadButton")}
              </button>
              {fileName ? (
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  <FileIcon className="w-4 h-4 text-muted-foreground" />
                  {fileName}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("importPage.noFileSelected")}
                </span>
              )}
              <button
                onClick={downloadTemplate}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t("importPage.downloadTemplate")}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── Column picker ────────────────────────────────────────────────── */}
        {state === "column-pick" && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-1">
              {t("importPage.columnPickerHeading")}
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              {t("importPage.columnPickerSubheading")}
            </p>

            <div className="space-y-4">
              {/* ISBN column */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {t("importPage.columnPickerIsbnLabel")}
                </label>
                <div className="relative">
                  <select
                    value={isbnColIdx}
                    onChange={(e) => setIsbnColIdx(Number(e.target.value))}
                    className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {columns.map((col) => (
                      <option key={col.index} value={col.index}>
                        {col.header}
                        {col.sample.length > 0
                          ? ` — ${t("importPage.columnSample")} ${col.sample.slice(0, 2).join(", ")}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              {/* Quantity column */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {t("importPage.columnPickerQtyLabel")}
                  <span className="ml-1 font-normal text-muted-foreground">
                    {t("importPage.columnPickerQtyHint")}
                  </span>
                </label>
                <div className="relative">
                  <select
                    value={qtyColIdx}
                    onChange={(e) => setQtyColIdx(Number(e.target.value))}
                    className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value={-1}>{t("importPage.columnPickerNone")}</option>
                    {columns
                      .filter((col) => col.index !== isbnColIdx)
                      .map((col) => (
                        <option key={col.index} value={col.index}>
                          {col.header}
                          {col.sample.length > 0
                            ? ` — ${t("importPage.columnSample")} ${col.sample.slice(0, 2).join(", ")}`
                            : ""}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <button
              onClick={confirmColumns}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t("importPage.columnPickerConfirm")}
            </button>
          </div>
        )}

        {/* ── Preview ──────────────────────────────────────────────────────── */}
        {state === "preview" && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-success shrink-0" />
              <span className="text-sm font-semibold text-foreground">
                {hasQuantities
                  ? t("importPage.isbnCountWithCopies", {
                      isbns: entries.length,
                      copies: totalCopies,
                    })
                  : t("importPage.isbnCount", { count: entries.length })}
              </span>
            </div>
            <button
              onClick={runImport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <BookPlus className="w-4 h-4" />
              {t("importPage.startImport")}
            </button>
          </div>
        )}

        {/* ── Progress ─────────────────────────────────────────────────────── */}
        {state === "importing" && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("importPage.importing")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("importPage.progress", {
                done: progress,
                total: entries.length,
              })}
            </p>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(progress / entries.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {state === "done" && result && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              {t("importPage.resultHeading")}
            </h2>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success shrink-0" />
                <span className="text-sm text-foreground">
                  {t("importPage.successCount", { count: result.recordsCreated })}
                </span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {t("importPage.duplicateSkipped", { count: result.skipped })}
                  </span>
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  <span className="text-sm text-foreground">
                    {t("importPage.failedCount", { count: result.failed.length })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              {result.failed.length > 0 && (
                <button
                  onClick={downloadFailed}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t("importPage.downloadFailed")}
                </button>
              )}
              <button
                onClick={() => router.push("/book")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {t("nav.book.title")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
