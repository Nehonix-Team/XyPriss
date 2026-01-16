import { Sidebar } from "@/components/sidebar";
import { SiteHeader } from "@/components/site-header";

interface DocsLayoutProps {
    children: React.ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 px-4 md:px-8 max-w-screen-2xl">
                <Sidebar />
                <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
                    <div className="mx-auto w-full min-w-0">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
