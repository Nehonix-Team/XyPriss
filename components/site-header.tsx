import { Search } from "@/components/search";
import { ModeToggle } from "@/components/mode-toggle";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container px-4 md:px-8 flex h-14 max-w-screen-2xl items-center">
                <div className="mr-4 flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-indigo-500" />
                        <span className="hidden font-bold sm:inline-block">
                            XYPriss
                        </span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/docs"
                            className="transition-colors hover:text-foreground/80 text-foreground"
                        >
                            Docs
                        </Link>
                        <Link
                            href="https://github.com/nehonix/xypriss"
                            className="transition-colors hover:text-foreground/80 text-muted-foreground"
                        >
                            GitHub
                        </Link>
                    </nav>
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        <Search />
                    </div>
                    <ModeToggle />
                </div>
            </div>
        </header>
    );
}
