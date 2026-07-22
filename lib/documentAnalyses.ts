import { requireSql } from "./db";
import type { AnalysisKind, BankStatementExtraction, PaystubExtraction } from "./openaiExtractor";

export type DocumentAnalysis = {
  id: string;
  driveFileId: string;
  fileName: string;
  kind: AnalysisKind;
  extracted: PaystubExtraction | BankStatementExtraction;
  model: string;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  drive_file_id: string;
  file_name: string;
  kind: AnalysisKind;
  extracted_json: PaystubExtraction | BankStatementExtraction;
  model: string;
  created_at: string;
  updated_at: string;
};

function toAnalysis(row: Row): DocumentAnalysis {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    fileName: row.file_name,
    kind: row.kind,
    extracted: row.extracted_json,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listAnalyses(ownerSub: string): Promise<DocumentAnalysis[]> {
  const sql = requireSql();
  const rows = (await sql`
    select id, drive_file_id, file_name, kind, extracted_json, model, created_at, updated_at
    from document_analyses
    where owner_sub = ${ownerSub}
    order by updated_at desc
  `) as Row[];
  return rows.map(toAnalysis);
}

export async function upsertAnalysis(params: {
  ownerSub: string;
  driveFileId: string;
  fileName: string;
  kind: AnalysisKind;
  extracted: PaystubExtraction | BankStatementExtraction;
  model: string;
}): Promise<DocumentAnalysis> {
  const sql = requireSql();
  const rows = (await sql`
    insert into document_analyses (owner_sub, drive_file_id, file_name, kind, extracted_json, model, updated_at)
    values (${params.ownerSub}, ${params.driveFileId}, ${params.fileName}, ${params.kind}, ${JSON.stringify(params.extracted)}::jsonb, ${params.model}, now())
    on conflict (owner_sub, drive_file_id) do update set
      file_name = excluded.file_name,
      kind = excluded.kind,
      extracted_json = excluded.extracted_json,
      model = excluded.model,
      updated_at = now()
    returning id, drive_file_id, file_name, kind, extracted_json, model, created_at, updated_at
  `) as Row[];
  return toAnalysis(rows[0]);
}

export async function deleteAnalysis(ownerSub: string, driveFileId: string): Promise<boolean> {
  const sql = requireSql();
  const rows = await sql`
    delete from document_analyses
    where owner_sub = ${ownerSub} and drive_file_id = ${driveFileId}
    returning id
  `;
  return rows.length > 0;
}
