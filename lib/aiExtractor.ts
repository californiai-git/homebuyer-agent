import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Dispatches PDF-to-structured-JSON extraction between OpenAI's Responses
 * API and Google's Gemini API. Provider is picked from `AI_PROVIDER` env
 * var, or auto-selected based on which API key is configured (Gemini
 * preferred, since its free tier makes it the sensible default for
 * personal/side-project use).
 */

const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

// Whole-PDF cap sent to the model as inline base64. Keeps token cost and
// upload time bounded even if a user drops in a 20-page statement.
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured. Set GEMINI_API_KEY (recommended, free tier available) or OPENAI_API_KEY to enable document analysis.");
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

const PROMPTS: Record<AnalysisKind, string> = {
  paystub:
    "You are extracting values from a single pay stub PDF. Return only what is explicitly on the document. Use null for any field you cannot read with confidence. Currency values should be numbers (no $ or commas).",
  bank_statement:
    "You are extracting summary values from a bank statement PDF. Return only what is explicitly on the document. For recurringOutflowsMonthly, estimate the total dollar amount of recurring monthly outflows (rent/mortgage, subscriptions, loan payments, utilities); exclude one-off large transfers between the customer's own accounts. Use null for anything unclear. Currency values should be numbers (no $ or commas)."
};

type Provider = "openai" | "gemini";

function currentProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER;
  if (explicit === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (explicit === "openai") return process.env.OPENAI_API_KEY ? "openai" : null;
  // Auto-select: prefer Gemini (free tier) if configured, else OpenAI.
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/** Where the currently-active AI backend runs. Returned to the UI for provenance. */
export function currentProviderLabel(): string {
  const provider = currentProvider();
  if (!provider) return "not configured";
  const model = provider === "gemini"
    ? (process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL)
    : (process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL);
  return `${provider}:${model}`;
}

export async function extract(
  kind: AnalysisKind,
  pdfBytes: ArrayBuffer,
  fileName: string
): Promise<{ data: PaystubExtraction | BankStatementExtraction; model: string }> {
  const provider = currentProvider();
  if (!provider) throw new AiNotConfiguredError();
  if (pdfBytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF is too large (${Math.round(pdfBytes.byteLength / 1024 / 1024)} MB). Maximum is ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
  }

  return provider === "gemini"
    ? extractWithGemini(kind, pdfBytes, fileName)
    : extractWithOpenAI(kind, pdfBytes, fileName);
}

// -------- OpenAI --------

const OPENAI_PAYSTUB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    grossPay: { type: ["number", "null"] },
    netPay: { type: ["number", "null"] },
    payFrequency: { type: "string", enum: ["weekly", "biweekly", "semimonthly", "monthly", "unknown"] },
    payDate: { type: ["string", "null"] },
    employer: { type: ["string", "null"] },
    notes: { type: ["string", "null"] }
  },
  required: ["grossPay", "netPay", "payFrequency", "payDate", "employer", "notes"]
} as const;

const OPENAI_BANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    statementStart: { type: ["string", "null"] },
    statementEnd: { type: ["string", "null"] },
    totalDeposits: { type: ["number", "null"] },
    totalWithdrawals: { type: ["number", "null"] },
    endingBalance: { type: ["number", "null"] },
    recurringOutflowsMonthly: { type: ["number", "null"] },
    notes: { type: ["string", "null"] }
  },
  required: ["statementStart", "statementEnd", "totalDeposits", "totalWithdrawals", "endingBalance", "recurringOutflowsMonthly", "notes"]
} as const;

async function extractWithOpenAI(kind: AnalysisKind, pdfBytes: ArrayBuffer, fileName: string) {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  const b64 = Buffer.from(pdfBytes).toString("base64");
  const schema = kind === "paystub" ? OPENAI_PAYSTUB_SCHEMA : OPENAI_BANK_SCHEMA;
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
    text: { format: { type: "json_schema", name: schemaName, schema, strict: true } }
  });

  const output = response.output_text;
  if (!output) throw new Error("OpenAI returned no output. The document may be scanned or unreadable.");
  return { data: JSON.parse(output) as PaystubExtraction | BankStatementExtraction, model: `openai:${model}` };
}

// -------- Gemini --------

const GEMINI_PAYSTUB_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    grossPay: { type: Type.NUMBER, nullable: true, description: "Gross earnings for this pay period, in dollars." },
    netPay: { type: Type.NUMBER, nullable: true, description: "Net (take-home) pay for this pay period, in dollars." },
    payFrequency: { type: Type.STRING, enum: ["weekly", "biweekly", "semimonthly", "monthly", "unknown"] },
    payDate: { type: Type.STRING, nullable: true, description: "Pay date in YYYY-MM-DD format, if visible." },
    employer: { type: Type.STRING, nullable: true },
    notes: { type: Type.STRING, nullable: true, description: "Anything unusual or uncertain." }
  },
  required: ["grossPay", "netPay", "payFrequency", "payDate", "employer", "notes"],
  propertyOrdering: ["grossPay", "netPay", "payFrequency", "payDate", "employer", "notes"]
};

const GEMINI_BANK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    statementStart: { type: Type.STRING, nullable: true, description: "Statement period start in YYYY-MM-DD." },
    statementEnd: { type: Type.STRING, nullable: true, description: "Statement period end in YYYY-MM-DD." },
    totalDeposits: { type: Type.NUMBER, nullable: true },
    totalWithdrawals: { type: Type.NUMBER, nullable: true },
    endingBalance: { type: Type.NUMBER, nullable: true },
    recurringOutflowsMonthly: {
      type: Type.NUMBER,
      nullable: true,
      description: "Estimated recurring monthly outflows (rent/mortgage, subscriptions, loan payments, utilities). Exclude one-off large transfers."
    },
    notes: { type: Type.STRING, nullable: true }
  },
  required: ["statementStart", "statementEnd", "totalDeposits", "totalWithdrawals", "endingBalance", "recurringOutflowsMonthly", "notes"],
  propertyOrdering: ["statementStart", "statementEnd", "totalDeposits", "totalWithdrawals", "endingBalance", "recurringOutflowsMonthly", "notes"]
};

async function extractWithGemini(kind: AnalysisKind, pdfBytes: ArrayBuffer, fileName: string) {
  void fileName; // Gemini doesn't need a filename hint; kept in signature for parity with OpenAI.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const b64 = Buffer.from(pdfBytes).toString("base64");
  const schema = kind === "paystub" ? GEMINI_PAYSTUB_SCHEMA : GEMINI_BANK_SCHEMA;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPTS[kind] },
          { inlineData: { mimeType: "application/pdf", data: b64 } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const output = response.text;
  if (!output) throw new Error("Gemini returned no output. The document may be scanned or unreadable.");
  return { data: JSON.parse(output) as PaystubExtraction | BankStatementExtraction, model: `gemini:${model}` };
}
