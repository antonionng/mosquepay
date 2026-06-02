import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Member accounts are invite only." },
    { status: 403 }
  );
}
