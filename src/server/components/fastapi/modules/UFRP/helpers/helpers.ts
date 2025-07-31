// Helper functions for sorting algorithms

export function quickSort(
    arr: any[],
    order: "sort" | "desc" | "asc" = "asc"
): any[] {
    if (arr.length <= 1) return arr;

    const pivot = arr[Math.floor(arr.length / 2)];
    const left = arr.filter((x) => (order === "asc" ? x < pivot : x > pivot));
    const middle = arr.filter((x) => x === pivot);
    const right = arr.filter((x) => (order === "asc" ? x > pivot : x < pivot));

    return [...quickSort(left, order), ...middle, ...quickSort(right, order)];
}

export function mergeSort(
    arr: any[],
    order: "sort" | "desc" | "asc" = "asc"
): any[] {
    if (arr.length <= 1) return arr;

    const mid = Math.floor(arr.length / 2);
    const left = mergeSort(arr.slice(0, mid), order);
    const right = mergeSort(arr.slice(mid), order);

    return merge(left, right, order);
}

function merge(
    left: any[],
    right: any[],
    order: "sort" | "desc" | "asc" = "asc"
): any[] {
    const result = [];
    let leftIndex = 0,
        rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
        const condition =
            order === "asc"
                ? left[leftIndex] <= right[rightIndex]
                : left[leftIndex] >= right[rightIndex];
        if (condition) {
            result.push(left[leftIndex++]);
        } else {
            result.push(right[rightIndex++]);
        }
    }

    return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}

export function heapSort(
    arr: any[],
    order: "sort" | "desc" | "asc" = "asc"
): any[] {
    const n = arr.length;

    // Build heap
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        heapify(arr, n, i, order);
    }

    // Extract elements
    for (let i = n - 1; i > 0; i--) {
        [arr[0], arr[i]] = [arr[i], arr[0]];
        heapify(arr, i, 0, order);
    }

    return arr;
}

export function heapify(
    arr: any[],
    n: number,
    i: number,
    order: "sort" | "desc" | "asc" = "asc"
): void {
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    const compare = (a: number, b: number) => (order === "asc" ? a > b : a < b);

    if (left < n && compare(arr[left], arr[largest])) {
        largest = left;
    }

    if (right < n && compare(arr[right], arr[largest])) {
        largest = right;
    }

    if (largest !== i) {
        [arr[i], arr[largest]] = [arr[largest], arr[i]];
        heapify(arr, n, largest, order);
    }
}

// Helper functions for search
export function binarySearch(arr: any[], target: any): number {
    let left = 0,
        right = arr.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }

    return -1;
}

// Helper functions for data transformation
export function applyTransform(item: any, transform: any): any {
    switch (transform) {
        case "double":
            return item * 2;
        case "square":
            return item * item;
        case "uppercase":
            return String(item).toUpperCase();
        case "lowercase":
            return String(item).toLowerCase();
        default:
            return item;
    }
}

export function applyFilter(item: any, condition: any): boolean {
    switch (condition.type) {
        case "greater":
            return item > condition.value;
        case "less":
            return item < condition.value;
        case "equal":
            return item === condition.value;
        case "contains":
            return String(item).includes(condition.value);
        default:
            return true;
    }
}

export function applyReduce(acc: any, item: any, reducer: any): any {
    switch (reducer) {
        case "sum":
            return acc + item;
        case "product":
            return acc * item;
        case "count":
            return acc + 1;
        case "max":
            return Math.max(acc, item);
        case "min":
            return Math.min(acc, item);
        default:
            return acc;
    }
}

export function aggregateData(data: any, params: any): any {
    if (!Array.isArray(data)) return data;

    const { groupBy, aggregateBy, operation = "sum" } = params;
    const groups: Record<string, any[]> = {};

    data.forEach((item) => {
        const key = groupBy ? item[groupBy] : "all";
        if (!groups[key]) groups[key] = [];
        groups[key].push(aggregateBy ? item[aggregateBy] : item);
    });

    const result: Record<string, number> = {};
    for (const [key, values] of Object.entries(groups)) {
        switch (operation) {
            case "sum":
                result[key] = values.reduce((a, b) => a + b, 0);
                break;
            case "avg":
                result[key] = values.reduce((a, b) => a + b, 0) / values.length;
                break;
            case "count":
                result[key] = values.length;
                break;
            case "max":
                result[key] = Math.max(...values);
                break;
            case "min":
                result[key] = Math.min(...values);
                break;
        }
    }

    return result;
}

// Helper functions for validation
export function validateAgainstSchema(
    data: any,
    schema: any,
    errors: string[],
    warnings: string[],
    strict: boolean
): boolean {
    let isValid = true;

    for (const [key, rules] of Object.entries(schema) as [string, any][]) {
        const value = data[key];

        if (rules.required && (value === undefined || value === null)) {
            errors.push(`Missing required field: ${key}`);
            isValid = false;
            continue;
        }

        if (value !== undefined && rules.type && typeof value !== rules.type) {
            errors.push(
                `Invalid type for field ${key}: expected ${
                    rules.type
                }, got ${typeof value}`
            );
            isValid = false;
        }

        if (rules.min !== undefined && value < rules.min) {
            errors.push(`Field ${key} is below minimum value: ${rules.min}`);
            isValid = false;
        }

        if (rules.max !== undefined && value > rules.max) {
            errors.push(`Field ${key} exceeds maximum value: ${rules.max}`);
            isValid = false;
        }

        if (rules.pattern && !rules.pattern.test(String(value))) {
            errors.push(`Field ${key} does not match required pattern`);
            isValid = false;
        }
    }

    if (strict) {
        for (const key of Object.keys(data)) {
            if (!schema[key]) {
                warnings.push(`Unknown field: ${key}`);
            }
        }
    }

    return isValid;
}

// Mathematical computation helpers
export function factorial(n: number): number {
    if (n < 0) throw new Error("Factorial not defined for negative numbers");
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

export function fibonacci(n: number): number {
    if (n < 0) throw new Error("Fibonacci not defined for negative numbers");
    if (n <= 1) return n;
    let a = 0,
        b = 1;
    for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
    }
    return b;
}

export function isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
        if (n % i === 0) return false;
    }
    return true;
}

export function gcd(a: number, b: number): number {
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return Math.abs(a);
}

export function lcm(a: number, b: number): number {
    return Math.abs(a * b) / gcd(a, b);
}

export function matrixMultiply(a: any, b: any): any {
    if (!Array.isArray(a) || !Array.isArray(b)) {
        throw new Error("Matrix multiplication requires arrays");
    }

    const rows = a.length;
    const cols = b[0].length;
    const common = a[0].length;

    if (common !== b.length) {
        throw new Error("Matrix dimensions incompatible for multiplication");
    }

    const result = Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(0));

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            for (let k = 0; k < common; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }

    return result;
}

// Data parsing helpers
export function parseCSV(data: string, options: any): any[] {
    const { delimiter = ",", headers = true } = options;
    const lines = data.split("\n").filter((line) => line.trim());

    if (lines.length === 0) return [];

    const headerRow = headers ? lines[0].split(delimiter) : null;
    const dataRows = lines.slice(headers ? 1 : 0);

    return dataRows.map((line) => {
        const values = line.split(delimiter);
        if (headerRow) {
            const obj: Record<string, string> = {};
            headerRow.forEach((header, index) => {
                obj[header.trim()] = values[index]?.trim();
            });
            return obj;
        }
        return values.map((v) => v.trim());
    });
}

export function parseXML(data: string): Record<string, string> {
    // Simple XML parser - in production, use a proper XML parser
    const result: Record<string, string> = {};
    const tagRegex = /<(\w+)>(.*?)<\/\1>/g;
    let match;

    while ((match = tagRegex.exec(data)) !== null) {
        result[match[1]] = match[2];
    }

    return result;
}

// Analysis helpers
export function findMedian(sorted: any[]): number {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

export function findMode(arr: any[]) {
    const frequency: Record<string, number> = {};
    let maxFreq = 0;
    let modes: any[] = [];

    arr.forEach((item) => {
        frequency[item] = (frequency[item] || 0) + 1;
        if (frequency[item] > maxFreq) {
            maxFreq = frequency[item];
            modes = [item];
        } else if (frequency[item] === maxFreq) {
            modes.push(item);
        }
    });

    return modes.length === arr.length ? null : modes;
}

export function calculateVariance(arr: any[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return (
        arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length
    );
}

export function getTypeDistribution(arr: any[]): any {
    const types: Record<string, number> = {};
    arr.forEach((item) => {
        const type = typeof item;
        types[type] = (types[type] || 0) + 1;
    });
    return types;
}

export function findDuplicates(arr: any[]): any[] {
    const seen = new Set();
    const duplicates = new Set();

    arr.forEach((item) => {
        if (seen.has(item)) {
            duplicates.add(item);
        } else {
            seen.add(item);
        }
    });

    return Array.from(duplicates);
}

export function textAnalysis(text: string): any {
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const chars = text.length;
    const sentences = text
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 0).length;
    const paragraphs = text
        .split(/\n\s*\n/)
        .filter((p) => p.trim().length > 0).length;

    const wordFreq: Record<string, number> = {};
    words.forEach((word) => {
        const clean = word.toLowerCase().replace(/[^\w]/g, "");
        wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    });

    return {
        characters: chars,
        words: words.length,
        sentences,
        paragraphs,
        averageWordsPerSentence:
            Math.round((words.length / sentences) * 100) / 100,
        wordFrequency: Object.entries(wordFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [word, freq]) => ({ ...obj, [word]: freq }), {}),
    };
}
