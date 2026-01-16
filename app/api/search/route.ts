import { getAllDocs } from "@/lib/docs";
import { NextResponse } from "next/server";

export async function GET() {
    const docs = getAllDocs();
    const searchIndex = docs.map((doc) => ({
        title: doc.frontmatter.title || doc.slug,
        slug: doc.slug,
        content: doc.content.slice(0, 1000), // Index first 1000 chars for perf
        category: doc.frontmatter.category || "Documentation"
    }));

    return NextResponse.json(searchIndex);
}
