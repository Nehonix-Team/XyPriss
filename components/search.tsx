"use client";

import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import { SearchIcon, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Search() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/search")
            .then((res) => res.json())
            .then((data) => setItems(data));
    }, []);

    useEffect(() => {
        if (query.length > 0) {
            setIsOpen(true);
            const fuse = new Fuse(items, {
                keys: ["title", "slug", "content"],
                threshold: 0.3,
            });
            setResults(fuse.search(query).map((result) => result.item));
        } else {
            setResults([]);
            setIsOpen(false);
        }
    }, [query, items]);

    return (
        <div className="relative w-full max-w-sm">
            <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                    ref={inputRef}
                    type="search"
                    placeholder="Search documentation..."
                    className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 0 && setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                />
                {query && (
                    <button
                        onClick={() => setQuery("")}
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            {isOpen && results.length > 0 && (
                <div className="absolute top-full mt-2 w-full rounded-md border border-border bg-popover p-2 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-[300px] overflow-y-auto">
                        {results.map((result, index) => (
                            <Link
                                key={index}
                                href={`/docs/${result.slug}`}
                                className="block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                onClick={() => setQuery("")}
                            >
                                <div className="font-medium">{result.title}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {result.category}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
