import type {
  FinDocumentType,
  BankTxnType,
  ImportType,
} from "@/types/enums";

export type ColumnMapping = Record<string, string>;

export interface ParsedDocument {
  rowIndex: number;
  tipoDoc: string;
  type: FinDocumentType;
  folio: string;
  rut: string;
  nombre: string;
  fechaEmision: string; // ISO date
  fechaVencimiento: string | null;
  neto: number;
  iva: number;
  exento: number;
  total: number;
  isDuplicate?: boolean;
}

export interface ParsedTransaction {
  rowIndex: number;
  fecha: string; // ISO date
  glosa: string;
  monto: number; // siempre positivo
  tipo: BankTxnType;
  saldo: number | null;
  isDuplicate?: boolean;
}

export interface RejectedRow {
  rowIndex: number;
  reason: string;
}

export interface ImportSummary {
  rowsDetected: number;
  rowsValid: number;
  rowsRejected: number;
  duplicates: number;
  totalNeto: number;
  totalIva: number;
  totalBruto: number;
  fechaMin: string | null;
  fechaMax: string | null;
  warnings: string[];
}

export interface ImportPreview {
  type: ImportType;
  bankAccountId?: string;
  documents?: ParsedDocument[];
  transactions?: ParsedTransaction[];
  rejected: RejectedRow[];
  summary: ImportSummary;
}
