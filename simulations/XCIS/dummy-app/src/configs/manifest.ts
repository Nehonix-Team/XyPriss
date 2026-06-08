/**
 * Application Manifest
 * 
 * Retrieves the application metadata from the XyPriss system environment variables.
 * This manifest includes core identity information such as name, version, and author.
 */
export const manifest: IManifest = __sys__.vars.get("manifest");

/**
 * Manifest Structure Definition
 */
interface IManifest {
  /** Application name defined in package.json */
  name: string;
  /** Brief overview of the application's purpose */
  description: string;
  /** Semantic versioning string */
  version: string;
  /** Application creator or organization */
  author: string;
}
