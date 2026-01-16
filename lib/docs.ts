import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';


const docsDirectory = path.join(process.cwd(), 'content/docs');

export interface Doc {
    slug: string;
    frontmatter: Record<string, any>;
    content: string;
}

// Helper to recursively get all files
function getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            /* Recurse into a subdirectory */
            results = results.concat(getFilesRecursively(file));
        } else {
            /* Is a file */
            if (file.endsWith('.md')) {
                results.push(file);
            }
        }
    });
    return results;
}

export function getAllDocs(): Doc[] {
    const allFiles = getFilesRecursively(docsDirectory);

    const allDocsData = allFiles.map(fullPath => {
        const relativePath = path.relative(docsDirectory, fullPath);
        // Slug is the path without extension, e.g. "api/foo" or "bar"
        const slug = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');

        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data, content } = matter(fileContents);

        return {
            slug,
            frontmatter: data,
            content
        };
    });

    return allDocsData;
}

export async function getDocBySlug(slug: string): Promise<Doc | null> {
    // Slug might be "api/foo", so we need to construct path correctly
    const fullPath = path.join(docsDirectory, `${slug}.md`);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
        slug,
        frontmatter: data,
        content
    };
}
