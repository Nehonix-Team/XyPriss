#!/usr/bin/env node
/**
 * Build Script for TypeScript Executor
 * Creates standalone executables for the TypeScript executor
 * TypeScript Executor = TSE
 */

import { ExecutableBuilder } from './ExecutableBuilder';
import { join } from 'path';
 
async function main() {
    const args = process.argv.slice(2);
    const verbose = args.includes('--verbose') || args.includes('-v');
    const platform = args.find(arg => arg.startsWith('--platform='))?.split('=')[1] as any;
    const bundler = args.find(arg => arg.startsWith('--bundler='))?.split('=')[1] as any;

    console.log('Building TSE...');
 
    const builder = new ExecutableBuilder({
        outputDir: join(process.cwd(), 'dist', 'ts-executor'),
        platforms: platform ? [platform] : ['win32', 'linux', 'darwin'],
        verbose,
        bundler: bundler || 'esbuild',
        minify: !args.includes('--no-minify'),
    });

    try {
        if (platform) {
            await builder.buildForPlatform(platform);
        } else {
            await builder.buildAll();
        }

        console.log('✔ Build completed successfully!');
        console.log('Executables available in: dist/ts-executor/');
        
    } catch (error: any) {
        console.error('Build failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

export { main as buildExecutable };
