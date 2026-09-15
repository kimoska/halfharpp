import path from "node:path";
import { config } from "dotenv";

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || process.cwd(), "AppData", "Local");
export const secureEnvPath = path.join(localAppData, "MoharpAutomation", "secrets.env");

// Keep non-sensitive defaults in the project, but let the non-synced local file
// override them. This prevents API credentials from being stored in OneDrive.
config({ path: path.resolve(".env") });
config({ path: secureEnvPath, override: true });
