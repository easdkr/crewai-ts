export const __version__ = "0.0.0";
export const VERSION = __version__;

export function get_crewai_version(): string {
  return __version__;
}

export function get_latest_version_from_pypi(): Promise<string | null> {
  return Promise.resolve(null);
}

export function is_newer_version_available(currentVersion: string, latestVersion: string | null): boolean {
  if (!latestVersion) {
    return false;
  }
  return compareVersions(latestVersion, currentVersion) > 0;
}

export function is_current_version_yanked(_version: string = __version__): Promise<boolean> {
  void _version;
  return Promise.resolve(false);
}

export async function check_version(currentVersion: string = __version__): Promise<{
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  yanked: boolean;
}> {
  const latestVersion = await get_latest_version_from_pypi();
  return {
    current_version: currentVersion,
    latest_version: latestVersion,
    update_available: is_newer_version_available(currentVersion, latestVersion),
    yanked: await is_current_version_yanked(currentVersion),
  };
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(/[.-]/).map(numberOrZero);
  const rightParts = right.split(/[.-]/).map(numberOrZero);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function numberOrZero(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
