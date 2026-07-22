/**
 * Minimal Google Drive v3 REST client used to store a signed-in user's
 * sensitive homebuying documents inside their own Google Drive.
 *
 * Every user's documents live under a single root folder in *their own*
 * Drive:
 *
 *   homebuyer-agent/
 *     common/                 <- preapprovals, bank statements, income docs
 *     <house address>/        <- disclosures, inspections, offers, etc.
 *
 * Because every request is authorized with that user's own OAuth access
 * token (scoped to `drive.file`), Google's own access control already
 * guarantees one user can never read or write another user's folder - there
 * is no shared bucket or database row to accidentally leak across tenants.
 *
 * A plain `fetch`-based client is used here (rather than the `googleapis`
 * package) to keep this dependency-free and easy to audit.
 */

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export const ROOT_FOLDER_NAME = "homebuyer-agent";
export const COMMON_FOLDER_NAME = "common";

const FOLDER_FIELDS = "id,name,webViewLink";
const FILE_FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,iconLink";

export type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
};

/** Thrown when Google reports the access token is missing, expired, or revoked. */
export class DriveAuthError extends Error {}

/** Thrown for any other non-2xx response from the Drive API. */
export class DriveApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Escapes a value for safe interpolation into a Drive API `q` query string. */
export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Collapses whitespace and enforces a sane length for a house folder name. */
export function normalizeHouseFolderName(address: string): string {
  const trimmed = address.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    throw new RangeError("A house address is required.");
  }
  return trimmed.slice(0, 200);
}

async function driveFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${DRIVE_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    throw new DriveAuthError("Your Google session expired. Please sign in again.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new DriveApiError(`Google Drive request failed (${response.status}): ${body.slice(0, 300)}`, response.status);
  }

  return response;
}

async function findFolderByName(accessToken: string, name: string, parentId: string | null): Promise<DriveFolder | null> {
  const clauses = [
    `mimeType = '${FOLDER_MIME_TYPE}'`,
    `name = '${escapeDriveQueryValue(name)}'`,
    "trashed = false",
    parentId ? `'${escapeDriveQueryValue(parentId)}' in parents` : "'root' in parents"
  ];

  const query = new URLSearchParams({
    q: clauses.join(" and "),
    fields: `files(${FOLDER_FIELDS})`,
    spaces: "drive",
    pageSize: "1"
  });

  const response = await driveFetch(accessToken, `/files?${query.toString()}`);
  const data = (await response.json()) as { files: DriveFolder[] };
  return data.files[0] ?? null;
}

async function createFolder(accessToken: string, name: string, parentId: string | null): Promise<DriveFolder> {
  const response = await driveFetch(accessToken, `/files?fields=${FOLDER_FIELDS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: parentId ? [parentId] : undefined
    })
  });
  return (await response.json()) as DriveFolder;
}

async function ensureFolder(accessToken: string, name: string, parentId: string | null): Promise<DriveFolder> {
  const existing = await findFolderByName(accessToken, name, parentId);
  if (existing) return existing;
  return createFolder(accessToken, name, parentId);
}

/** Looks up the app's root folder without creating it. */
export async function findRootFolder(accessToken: string): Promise<DriveFolder | null> {
  return findFolderByName(accessToken, ROOT_FOLDER_NAME, null);
}

/** Looks up (or creates) the app's root folder in the user's My Drive. */
export async function ensureRootFolder(accessToken: string): Promise<DriveFolder> {
  return ensureFolder(accessToken, ROOT_FOLDER_NAME, null);
}

/** Looks up the shared "common" documents folder without creating it. */
export async function findCommonFolder(accessToken: string): Promise<DriveFolder | null> {
  const root = await findRootFolder(accessToken);
  if (!root) return null;
  return findFolderByName(accessToken, COMMON_FOLDER_NAME, root.id);
}

/** Looks up (or creates) the shared "common" documents folder. */
export async function ensureCommonFolder(accessToken: string): Promise<DriveFolder> {
  const root = await ensureRootFolder(accessToken);
  return ensureFolder(accessToken, COMMON_FOLDER_NAME, root.id);
}

/** Looks up a single house's document folder without creating it. */
export async function findHouseFolder(accessToken: string, address: string): Promise<DriveFolder | null> {
  const root = await findRootFolder(accessToken);
  if (!root) return null;
  return findFolderByName(accessToken, normalizeHouseFolderName(address), root.id);
}

/** Looks up (or creates) a single house's document folder, named after its address. */
export async function ensureHouseFolder(accessToken: string, address: string): Promise<DriveFolder> {
  const root = await ensureRootFolder(accessToken);
  return ensureFolder(accessToken, normalizeHouseFolderName(address), root.id);
}

/** Lists every per-house folder under the root (excluding the "common" folder). */
export async function listHouseFolders(accessToken: string): Promise<DriveFolder[]> {
  const root = await findRootFolder(accessToken);
  if (!root) return [];

  const query = new URLSearchParams({
    q: [
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      `'${escapeDriveQueryValue(root.id)}' in parents`,
      "trashed = false",
      `name != '${COMMON_FOLDER_NAME}'`
    ].join(" and "),
    fields: `files(${FOLDER_FIELDS})`,
    orderBy: "name",
    pageSize: "100"
  });

  const response = await driveFetch(accessToken, `/files?${query.toString()}`);
  const data = (await response.json()) as { files: DriveFolder[] };
  return data.files;
}

/** Lists the files directly inside a given folder, newest first. */
export async function listFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const query = new URLSearchParams({
    q: [`'${escapeDriveQueryValue(folderId)}' in parents`, "trashed = false"].join(" and "),
    fields: `files(${FILE_FIELDS})`,
    orderBy: "modifiedTime desc",
    pageSize: "100"
  });

  const response = await driveFetch(accessToken, `/files?${query.toString()}`);
  const data = (await response.json()) as { files: DriveFile[] };
  return data.files;
}

/** Permanently deletes a file the app previously uploaded. */
export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(accessToken, `/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}

/**
 * Uploads a file into the given folder using Drive's resumable upload
 * protocol: start a session with metadata, then PUT the file bytes.
 */
export async function uploadFile(accessToken: string, folderId: string, file: File): Promise<DriveFile> {
  const startResponse = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=resumable&fields=${FILE_FIELDS}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size)
      },
      body: JSON.stringify({ name: file.name, parents: [folderId] })
    }
  );

  if (startResponse.status === 401) {
    throw new DriveAuthError("Your Google session expired. Please sign in again.");
  }
  if (!startResponse.ok) {
    const body = await startResponse.text().catch(() => "");
    throw new DriveApiError(`Could not start the upload (${startResponse.status}): ${body.slice(0, 300)}`, startResponse.status);
  }

  const uploadUrl = startResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new DriveApiError("Google Drive did not return an upload session URL.", 502);
  }

  const bytes = await file.arrayBuffer();
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(file.size)
    },
    body: bytes
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text().catch(() => "");
    throw new DriveApiError(`Upload failed (${uploadResponse.status}): ${body.slice(0, 300)}`, uploadResponse.status);
  }

  return (await uploadResponse.json()) as DriveFile;
}
