"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { docsConfig } from "@/config/docs";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button"; // I don't have this, will use raw classes

export function Pager({ slug }: { slug: string }) {
    const pager = getPagerForDoc(slug);

    if (!pager) {
        return null;
    }

    return (
        <div className="flex flex-row items-center justify-between pt-6 border-t border-border mt-8">
            {pager.prev && (
                <Link
                    href={pager.prev.href}
                    className={cn("group flex items-center p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors mr-auto text-sm font-medium")}
                >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {pager.prev.title}
                </Link>
            )}
            {pager.next && (
                <Link
                    href={pager.next.href}
                    className={cn("group flex items-center p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors ml-auto text-sm font-medium")}
                >
                    {pager.next.title}
                    <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
            )}
        </div>
    );
}

function getPagerForDoc(slug: string) {
    const flattenedLinks = [null, ...docsConfig.sidebarNav.flatMap((section) => section.items || []), null];
    const activeIndex = flattenedLinks.findIndex((link) => link && link.href === `/docs/${slug}` || link?.href === slug); // slug might have /docs prefix or not depending on passed prop. 

    // Normalize slug to match hrefs: hrefs are /docs/foo
    const docPath = `/docs/${slug}`;
    const index = flattenedLinks.findIndex((link) => link && link.href === docPath);

    if (index === -1) return null;

    const prev = flattenedLinks[index - 1];
    const next = flattenedLinks[index + 1];
    return {
        prev,
        next,
    };
}
