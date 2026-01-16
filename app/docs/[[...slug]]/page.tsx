import { notFound } from "next/navigation";
import { getAllDocs, getDocBySlug } from "@/lib/docs";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/tokyo-night-dark.css";
import { Pager } from "@/components/pager";
import { Metadata } from "next";

interface DocPageProps {
    params: Promise<{
        slug?: string[];
    }>;
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
    const { slug } = await params;
    const slugPath = slug ? slug.join("/") : "README";
    const doc = await getDocBySlug(slugPath);

    if (!doc) {
        return {
            title: "Document Not Found",
        };
    }

    return {
        title: doc.frontmatter.title || doc.slug,
        description: doc.frontmatter.description || "XYPriss Documentation",
    };
}

export async function generateStaticParams() {
    const docs = getAllDocs();
    return docs.map((doc) => ({
        slug: doc.slug.split('/'),
    }));
}

export default async function DocPage({ params }: DocPageProps) {
    const { slug } = await params;
    const slugPath = slug ? slug.join("/") : "README";
    const doc = await getDocBySlug(slugPath);

    if (!doc) {
        // Try forcing to README if root
        if (!slug) {
            const readme = await getDocBySlug("README");
            if (readme) return renderDoc(readme, "README");
        }
        notFound();
    }

    return renderDoc(doc, slugPath);
}

function renderDoc(doc: any, slugPath: string) {
    return (
        <article className="prose prose-zinc dark:prose-invert max-w-none pb-12">
            <div className="space-y-2 mb-6">
                <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
                    {doc.frontmatter.title || doc.slug.split('/').pop().replace(/_/g, ' ')}
                </h1>
                {doc.frontmatter.description && (
                    <p className="text-xl text-muted-foreground">
                        {doc.frontmatter.description}
                    </p>
                )}
                <hr className="my-6 border-border" />
            </div>
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {doc.content}
            </ReactMarkdown>
            <Pager slug={slugPath} />
        </article>
    );
}
