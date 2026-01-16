"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Globe, Box } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32 overflow-hidden relative">
          <div className="absolute inset-0 -z-10 h-full w-full bg-background [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#63e_100%)] opacity-20 pointer-events-none" />

          <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl bg-muted px-4 py-1.5 text-sm font-medium"
            >
              XYPriss Documentation v1.0
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/50"
            >
              Build faster with <span className="text-indigo-500">XYPriss</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8"
            >
              The complete guide to the most advanced library for high-performance applications.
              Comprehensive API references, tutorials, and examples.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex gap-4"
            >
              <Link
                href="/docs/getting-started"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Documentation
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="container space-y-6 py-8 md:py-12 lg:py-24 mx-auto px-4">
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <FeatureCard
              icon={<Zap className="h-10 w-10 text-indigo-500" />}
              title="Lightning Fast"
              description="Optimized for performance with zero-runtime overhead."
              delay={0.1}
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10 text-indigo-500" />}
              title="Secure by Default"
              description="Built-in security features to protect your application."
              delay={0.2}
            />
            <FeatureCard
              icon={<Globe className="h-10 w-10 text-indigo-500" />}
              title="Global Scale"
              description="Designed to run on the edge, closest to your users."
              delay={0.3}
            />
            <FeatureCard
              icon={<Box className="h-10 w-10 text-indigo-500" />}
              title="Modular"
              description="Import only what you need. Tree-shakeable."
              delay={0.4}
            />
            <FeatureCard
              icon={<Zap className="h-10 w-10 text-indigo-500" />}
              title="Developer Experience"
              description="Typed API, autocomplete, and great documentation."
              delay={0.5}
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10 text-indigo-500" />}
              title="Enterprise Ready"
              description="Used by top companies for mission-critical apps."
              delay={0.6}
            />
          </div>
        </section>
      </main>
      <footer className="border-t border-border/40 py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row mx-auto px-4">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by{" "}
            <a
              href="#"
              className="font-medium underline underline-offset-4"
            >
              Nehonix Team
            </a>
            . The source code is available on{" "}
            <a
              href="#"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="relative overflow-hidden rounded-lg border bg-background p-6 select-none hover:shadow-md transition-shadow"
    >
      <div className="flex h-[180px] flex-col justify-between rounded-md p-2">
        {icon}
        <div className="space-y-2">
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </motion.div>
  )
}
