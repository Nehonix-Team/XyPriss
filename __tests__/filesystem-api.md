
### Path Operations

These methods provide cross-platform path manipulation utilities, leveraging the underlying `node:path` module but with enhanced root-aware behavior where applicable.

| Method                   | Description                                                                       |
| :----------------------- | :-------------------------------------------------------------------------------- |
| `$resolve(...paths)`     | Resolves path segments into an absolute path relative to the project root.        |
| `$join(...paths)`        | Joins path segments using platform-specific separators and normalizes the result. |
| `$dirname(path)`         | Returns the directory portion of a path.                                          |
| `$basename(path, [ext])` | Returns the last portion of a path (filename or last directory).                  |
| `$extname(path)`         | Returns the file extension, including the leading dot.                            |
| `$relative(from, to)`    | Computes the relative path from one location to another.                          |
| `$normalize(path)`       | Resolves '.' and '..' segments and eliminates redundant separators.               |
| `$parse(path)`           | Breaks down a path into root, dir, base, ext, and name components.                |
| `$format(pathObject)`    | Reconstructs a path string from a parsed path object.                             |

### Existence & Type Checks

Utilities for verifying the presence and nature of file system entries.

| Method             | Description                                                 |
| :----------------- | :---------------------------------------------------------- |
| `$exists(path)`    | Synchronously checks if a file or directory exists.         |
| `$isDir(path)`     | Verifies if the specified path points to a directory.       |
| `$isFile(path)`    | Verifies if the specified path points to a regular file.    |
| `$isSymlink(path)` | Identifies if the specified path is a symbolic link.        |
| `$isEmpty(path)`   | Checks if a directory is empty or if a file has zero bytes. |

### File Reading

Methods for retrieving data from files with support for various formats and safety checks.

| Method                         | Description                                              |
| :----------------------------- | :------------------------------------------------------- |
| `$readFile(path, [options])`   | Reads the entire contents of a file (defaults to UTF-8). |
| `$readJson(path)`              | Reads and parses a JSON file into a JavaScript object.   |
| `$readJsonSafe(path, default)` | Safely reads JSON, returning a default value on failure. |
| `$readLines(path)`             | Reads a file and returns an array of its lines.          |
| `$readNonEmptyLines(path)`     | Reads a file and returns only non-empty, trimmed lines.  |

### File Writing

Methods for creating and modifying file content, with automatic directory creation.

| Method                           | Description                                                          |
| :------------------------------- | :------------------------------------------------------------------- |
| `$writeFile(path, data, [opts])` | Writes data to a file, creating parent directories if necessary.     |
| `$writeJson(path, data, [opts])` | Serializes an object to JSON and writes it with 2-space indentation. |
| `$append(path, data, [opts])`    | Appends data to the end of a file.                                   |
| `$appendLine(path, line)`        | Appends a single line with an automatic newline character.           |
| `$touch(path)`                   | Creates an empty file or updates the timestamps of an existing one.  |
| `$writeIfNotExists(path, data)`  | Writes data only if the file does not already exist.                 |

### Directory Operations

Comprehensive tools for managing directory structures and listings.

| Method                         | Description                                                        |
| :----------------------------- | :----------------------------------------------------------------- |
| `$mkdir(path, [recursive])`    | Creates a directory (recursive by default).                        |
| `$ensureDir(path)`             | Guarantees a directory exists without throwing if it already does. |
| `$ls(path)`                    | Lists the names of items within a directory.                       |
| `$lsFullPath(path)`            | Lists items in a directory with their full absolute paths.         |
| `$lsFiles(path)`               | Lists only the regular files in a directory.                       |
| `$lsDirs(path)`                | Lists only the subdirectories in a directory.                      |
| `$lsRecursive(path, [filter])` | Recursively lists all files in a directory tree.                   |
| `$findByExt(path, ext)`        | Recursively finds files matching a specific extension.             |
| `$findByPattern(path, regex)`  | Recursively finds files matching a regular expression.             |

### Copy & Move Operations

| Method                          | Description                                                      |
| :------------------------------ | :--------------------------------------------------------------- |
| `$copy(src, dest, [overwrite])` | Copies a file or directory recursively.                          |
| `$duplicate(path, newName)`     | Creates a copy of an item in the same directory with a new name. |
| `$move(src, dest)`              | Moves or renames a file or directory.                            |
| `$rename(path, newName)`        | Renames an item within its current directory.                    |

### Delete Operations

| Method                 | Description                                                             |
| :--------------------- | :---------------------------------------------------------------------- |
| `$rm(path, [options])` | Removes a file or directory recursively.                                |
| `$rmIfExists(path)`    | Removes an item only if it exists, preventing errors.                   |
| `$emptyDir(path)`      | Deletes all contents of a directory but preserves the directory itself. |

### File Statistics & Metadata

| Method              | Description                                                  |
| :------------------ | :----------------------------------------------------------- |
| `$stats(path)`      | Retrieves detailed metadata (size, timestamps, permissions). |
| `$size(path)`       | Returns the size of a file in bytes.                         |
| `$sizeHuman(path)`  | Returns a human-readable size string (e.g., "1.5 MB").       |
| `$sizeDir(path)`    | Calculates the total size of a directory recursively.        |
| `$createdAt(path)`  | Returns the creation date of the entry.                      |
| `$modifiedAt(path)` | Returns the last modification date.                          |
| `$accessedAt(path)` | Returns the last access date.                                |

### Comparison & Search

| Method                      | Description                                                          |
| :-------------------------- | :------------------------------------------------------------------- |
| `$isSameContent(p1, p2)`    | Compares two files byte-for-byte for equality.                       |
| `$isNewer(p1, p2)`          | Checks if the first file was modified more recently than the second. |
| `$isOlder(p1, p2)`          | Checks if the first file is older than the second.                   |
| `$searchInFiles(dir, text)` | Recursively searches for files containing specific text.             |

### Advanced Utilities

| Method                     | Description                                                         |
| :------------------------- | :------------------------------------------------------------------ |
| `$uniqueFilename(path)`    | Generates a non-conflicting filename (e.g., "file (1).txt").        |
| `$mkdtemp([prefix])`       | Creates a unique temporary directory.                               |
| `$readForClipboard(path)`  | Reads file content with normalized Unix-style line endings.         |
| `$watch(path, callback)`   | Monitors a file or directory for real-time changes.                 |
| `$batchProcess(dir, proc)` | Applies a transformation function to all files in a directory tree. |
| `$backup(path, [suffix])`  | Creates a backup copy of a file or directory.                       |
| `$restore(path, [suffix])` | Restores an item from its backup copy.                              |
