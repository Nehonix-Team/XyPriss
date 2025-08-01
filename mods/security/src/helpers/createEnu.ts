export function createEnum<T extends readonly string[]>(values: T) {
    return Object.fromEntries(
        values.map((value) => [
            value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
            value,
        ])
    ) as { [K in T[number] as Uppercase<K>]: K };
}

// How the function works:

// 1. T extends readonly string[] - Generic constraint
//    T must be a readonly array of strings like ["a", "b", "c"] as const

// 2. T[number] - Gets union type of array elements
//    If T = ["pbkdf2", "scrypt"] as const
//    Then T[number] = "pbkdf2" | "scrypt"

// 3. [K in T[number] as Uppercase<K>]: K - Mapped type
//    K iterates over each string in the union
//    as Uppercase<K> transforms the key: "pbkdf2" becomes "PBKDF2"
//    : K sets the value to the original string
//    Result: { PBKDF2: "pbkdf2", SCRYPT: "scrypt" }

// 4. Object.fromEntries + map creates the runtime object
//    ["pbkdf2", "scrypt"] becomes [["PBKDF2", "pbkdf2"], ["SCRYPT", "scrypt"]]
//    Then becomes { PBKDF2: "pbkdf2", SCRYPT: "scrypt" }

// 5. as {...} assertion tells TypeScript the exact type
//    Without it, TypeScript would infer Record<string, string>
