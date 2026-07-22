import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ANY_HOME_TYPE } from "@/lib/listings";
import { dbErrorResponse } from "@/lib/db";
import { createSavedSearch, deleteSavedSearch, listSavedSearches } from "@/lib/savedSearches";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return null;
  }
  return { id: session.user.id, email: session.user.email };
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with Google to manage saved searches." }, { status: 401 });
  }

  try {
    const searches = await listSavedSearches(user.id);
    return NextResponse.json({ searches });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with Google to manage saved searches." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 200) : "";
  const maxPrice = Number(body?.maxPrice);
  const homeType = typeof body?.homeType === "string" && body.homeType ? body.homeType : ANY_HOME_TYPE;

  if (!name) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    return NextResponse.json({ error: "A valid maximum price is required." }, { status: 400 });
  }

  try {
    const search = await createSavedSearch({
      ownerSub: user.id,
      ownerEmail: user.email,
      name,
      query,
      maxPrice,
      homeType
    });
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with Google to manage saved searches." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "An id is required." }, { status: 400 });
  }

  try {
    const deleted = await deleteSavedSearch(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Saved search not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
