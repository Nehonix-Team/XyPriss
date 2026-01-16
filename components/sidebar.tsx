"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { docsConfig } from "@/config/docs";
import { motion } from "framer-motion";

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block overflow-y-auto border-r border-border bg-background py-6 pr-6 lg:py-8">
            <div className="w-full">
                {docsConfig.sidebarNav.map((item, index) => (
                    <div key={index} className="pb-4">
                        <h4 className="mb-1 rounded-md px-2 py-1 text-sm font-semibold">
                            {item.title}
                        </h4>
                        {item.items?.length ? (
                            <div className="grid grid-flow-row auto-rows-max text-sm">
                                {item.items.map((subItem, subIndex) => {
                                    const isActive = pathname === subItem.href;
                                    return (
                                        <Link
                                            key={subIndex}
                                            href={subItem.href}
                                            className={cn(
                                                "group flex w-full items-center rounded-md border border-transparent px-2 py-1.5 hover:underline decoration-muted-foreground/50",
                                                isActive
                                                    ? "font-medium text-foreground bg-accent/50"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-active-indicator"
                                                    className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                />
                                            )}
                                            {subItem.title}
                                        </Link>
                                    )
                                })}
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </aside>
    );
}
