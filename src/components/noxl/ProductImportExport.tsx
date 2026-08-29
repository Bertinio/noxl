import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importProducts, listProducts, listUnits } from "@/lib/noxl.functions";
import { useQuery } from "@tanstack/react-query";

type ParsedRow = {
  name: string;
  description: string | null;
  unit_price: number;
  category: string | null;
  unit: string;
};
type PreviewRow = { row: number; data?: ParsedRow; errors: string[] };

function normalizeRows(raw: Record<string, unknown>[], allowedUnits: string[]): PreviewRow[] {
  return raw.map((r, i) => {
    const keys: Record<string, unknown> = {};
    for (const k of Object.keys(r)) keys[k.toLowerCase().trim()] = r[k];
    const name = String(keys["name"] ?? "").trim();
    const description = keys["description"] != null ? String(keys["description"]).trim() : "";
    const priceRaw = keys["unit_price"];
    const category = keys["category"] != null ? String(keys["category"]).trim() : "";
    const unitRaw = keys["unit"] != null ? String(keys["unit"]).trim().toLowerCase() : "";
    const unit = allowedUnits.includes(unitRaw) ? unitRaw : "stuk";
    const errors: string[] = [];
    if (!name) errors.push("name is verplicht");
    const priceNum = typeof priceRaw === "number"
      ? priceRaw
      : Number(String(priceRaw ?? "").replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum < 0) errors.push("unit_price ongeldig");
    if (name.length > 200) errors.push("name te lang");
    if (unitRaw && !allowedUnits.includes(unitRaw)) errors.push(`unit ongeldig (${allowedUnits.join("/")})`);
    return {
      row: i + 2,
      data: errors.length === 0
        ? { name, description: description || null, unit_price: priceNum, category: category || null, unit }
        : undefined,
      errors,
    };
  });
}


export function ProductImportExport() {
  const qc = useQueryClient();
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const doImport = useServerFn(importProducts);
  const fetchUnits = useServerFn(listUnits);
  const unitsQ = useQuery({ queryKey: ["units"], queryFn: () => fetchUnits() });
  const allowedUnits = (unitsQ.data ?? []).map((u) => u.code);
  const doList = useServerFn(listProducts);

  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewSource, setPreviewSource] = useState<"xlsx" | "csv">("xlsx");
  const [exporting, setExporting] = useState<null | "xlsx" | "csv">(null);

  const importMut = useMutation({
    mutationFn: async (rows: ParsedRow[]) => doImport({ data: { rows } }),
    onSuccess: (res) => {
      toast.success(`${previewSource.toUpperCase()} geïmporteerd (${res.count} producten)`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleXlsx(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      setPreviewSource("xlsx");
      setPreview(normalizeRowsX(json));
    } catch (e) {
      toast.error("Kon XLSX niet lezen: " + (e as Error).message);
    }
  }

  function handleCsv(file: File) {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setPreviewSource("csv");
        setPreview(normalizeRowsX(res.data));
      },
      error: (err) => toast.error("Kon CSV niet lezen: " + err.message),
    });
  }

  async function fetchAll() {
    const rows = await doList();
    return rows.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      unit_price: Number(p.unit_price) || 0,
      category: p.category ?? "",
      unit: p.unit ?? "stuk",
    }));
  }

  const EXPORT_COLS = ["name", "description", "unit_price", "category", "unit"];

  async function exportXlsx() {
    setExporting("xlsx");
    try {
      const rows = await fetchAll();
      const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Producten");
      XLSX.writeFile(wb, `producten-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("XLSX geëxporteerd");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  async function exportCsv() {
    setExporting("csv");
    try {
      const rows = await fetchAll();
      const csv = Papa.unparse(rows, { columns: EXPORT_COLS });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `producten-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV geëxporteerd");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }


  const validRows = (preview ?? []).filter((r) => r.data).map((r) => r.data!) as ParsedRow[];
  const errorCount = (preview ?? []).filter((r) => r.errors.length > 0).length;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input
          ref={xlsxInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleXlsx(f); e.target.value = ""; }}
        />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsv(f); e.target.value = ""; }}
        />
        <Button variant="outline" onClick={() => xlsxInputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Importeer XLSX
        </Button>
        <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Importeer CSV
        </Button>
        <Button variant="outline" onClick={exportXlsx} disabled={exporting !== null}>
          {exporting === "xlsx" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          Exporteer XLSX
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={exporting !== null}>
          {exporting === "csv" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          Exporteer CSV
        </Button>
      </div>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview import ({previewSource.toUpperCase()})</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">
            {validRows.length} geldige rij(en){errorCount > 0 && `, ${errorCount} met fouten`}.
            Bestaande producten met dezelfde naam worden bijgewerkt.
          </div>
          <div className="max-h-[50vh] overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rij</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Eenheid</TableHead>
                  <TableHead className="text-right">Prijs</TableHead>
                  <TableHead>Beschrijving</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(preview ?? []).map((r) => (
                  <TableRow key={r.row} className={r.errors.length ? "bg-destructive/10" : ""}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>{r.data?.name ?? "—"}</TableCell>
                    <TableCell>{r.data?.category ?? "—"}</TableCell>
                    <TableCell>{r.data?.unit ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.data ? r.data.unit_price.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.data?.description ?? "—"}</TableCell>
                    <TableCell>

                      {r.errors.length === 0
                        ? <span className="text-emerald-600">OK</span>
                        : <span className="text-destructive">{r.errors.join(", ")}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Annuleren</Button>
            <Button
              onClick={() => importMut.mutate(validRows)}
              disabled={importMut.isPending || validRows.length === 0}
            >
              {importMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Bevestigen & importeren ({validRows.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
