import OpenAI from "openai";

/**
 * Server-side pipeline that turns a PDF (pay stub or bank statement) into
 * structured JSON via the OpenAI Responses API. Sends the raw PDF bytes as
 * an inline file input, so extraction runs on the model side without us
 * having to OCR locally.
 */

const DEFAULT_MODEL = "gpt-4o-mini";
// Whole-PDF cap sent to the model as inline base64. Keeps token cost and
// upload time bounded even if a user drops in a 20-page statement.
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const client = process.env.OPENAI_API_KEY ? new OpenAI() : null;

export class OpenAiNotConfiguredError extends Error {
  constructor() {
    super("OpenAI is not configured. Set OPENAI_API_KEY to enable document analysis.");
  }
}

export type AnalysisKind = "paystub" | "bank_statement";

export type PaystubExtraction = {
  grossPay: number | null;
  netPay: number | null;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "unknown";
  payDate: string | null;
  employer: string | null;
  notes: string | null;
};

export type BankStatementExtraction = {
  statementStart: string | null;
  statementEnd: string | null;
  totalDeposits: number | null;
  totalWithdrawals: number | null;
  endingBalance: number | null;
  recurringOutflowsMonthly: number | null;
  notes: string | null;
};

const PAYSTUB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    grossPay: { type: ["number", "null"], description: "Gross earnings for this pay period, in dollars." },
    netPay: { type: ["number", "null"], description: "Net (take-home) pay for this pay period, in dollars." },
    payFrequency: { type: "string", enum: ["weekly", "biweekly", "semimonthly", "monthly", "unknown"] },
    payDate: { type: ["string", "null"], description: "Pay date in YYYY-MM-DD format, if visible." },
    employer: { type: ["string", "null"] },
    notes: { type: ["string", "null"], description: "Anything unusual or uncertain about this extraction." }
  },
  required: ["grossPay", "netPay", "payFrequency", "payDate", "employer", "notes"]
} as const;

const BANK_STATEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    statementStart: { type: ["string", "null"], description: "Statement period start in YYYY-MM-DD." },
    statementEnd: { type: ["string", "null"], description: "Statement period end in YYYY-MM-DD." },
    totalDeposits: { type: ["number", "null"] },
    totalWithdrawals: { type: ["number", "null"] },
    endingBalance: { type: ["number", "null"] },
    recurringOutflowsMonthly: {
      type: ["number", "null"],
      description: "Estimated recurring monthly outflows (rent/mortgage, subscriptions, loan payments, utilities). Exclude one-off large transfers."
    },
    notes: { type: ["string", "null"] }
  },
  required: ["statementStart", "statementEnd", "totalDeposits", "totalWithdrawals", "endingBalance", "recurringOutflowsMonthly", "notes"]
} as const;

const PROMPTS: Record<AnalysisKind, string> = {
  paystub:
    "You are extracting values from a single pay stub PDF. Return only what is explicitly on the document. Use null for any field you cannot read with confidence. Currency values should be numbers (no $ or commas).",
  bank_statement:
    "You are extracting summary values from a bank statement PDF. Return only what is explicitly on the document. For recurringOutflowsMonthly, estimate the total dollar amount of recurring monthly outflows (rent/mortgage, subscriptions, loan payments, utilities); exclude one-off large transfers between the customer's own accounts. Use null for anything unclear. Currency values should be numbers (no $ or commas)."
};

export async function extract(
  kind: AnalysisKind,
  pdfBytes: ArrayBuffer,
  fileName: string
): Promise<{ data: PaystubExtraction | BankStatementExtraction; model: string }> {
  if (!client) throw new OpenAiNotConfiguredError();
  if (pdfBytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF is too large (${Math.round(pdfBytes.byteLength / 1024 / 1024)} MB). Maximum is ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const b64 = Buffer.from(pdfBytes).toString("base64");
  const schema = kind === "paystub" ? PAYSTUB_SCHEMA : BANK_STATEMENT_SCHEMA;
  const schemaName = kind === "paystub" ? "PaystubExtraction" : "BankStatementExtraction";

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: PROMPTS[kind] },
          { type: "input_file", filename: fileName, file_data: `data:application/pdf;base64,${b64}` }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        schema,
        strict: true
      }
    }
  });

  const output = response.output_text;
  if (!output) {
    throw new Error("OpenAI returned no output. The document may be scanned or unreadable.");
  }

  const parsed = JSON.parse(output) as PaystubExtraction | BankStatementExtraction;
  return { data: parsed, model };
}
