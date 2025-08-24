// app/api/videos/route.ts
import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic"; // toujours frais (pas de cache build)
export const runtime = "nodejs"; // nécessaire pour utiliser 'fs' côté serveur


export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "bg", "videos");
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && /\.(mp4|webm|ogg)$/i.test(e.name))
      .map((e) => `/bg/videos/${e.name}`);

    return NextResponse.json({ files });
  } catch (err) {
    // Dossier absent ou vide → renvoyer une liste vide
    return NextResponse.json({ files: [] });
  }
}
