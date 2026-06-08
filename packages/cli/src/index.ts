// CLI entry point for `crewai-ts`. Implemented in tasks 11-15.
const VERSION = "0.1.0";
export const CLI_VERSION = VERSION;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`crewai-ts v${VERSION} (scaffold; logic added in tasks 11-15)`);
}
