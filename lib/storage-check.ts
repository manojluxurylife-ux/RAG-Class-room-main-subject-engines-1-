/**
 * Device storage check — uses the browser's Storage API to estimate how
 * much space is actually free, so we can proactively offer "save to your
 * Google Drive instead" before a download fails or fills up the device.
 *
 * navigator.storage.estimate() gives the browser's storage quota, not the
 * device's true free disk space — but on most Android/iOS browsers this
 * quota is tied closely to actual free space, so it's a reasonable proxy
 * without needing any native permission.
 */

export interface StorageStatus {
  usageMB:     number;
  quotaMB:     number;
  availableMB: number;
  isLow:       boolean;
  supported:   boolean;
}

const LOW_THRESHOLD_MB = 150; // below this, device is "running low"

export async function checkDeviceStorage(estimatedFileMB = 5): Promise<StorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usageMB: 0, quotaMB: 0, availableMB: Infinity, isLow: false, supported: false };
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const usageMB = usage / (1024 * 1024);
    const quotaMB = quota / (1024 * 1024);
    const availableMB = quotaMB - usageMB;
    const isLow = availableMB < LOW_THRESHOLD_MB || availableMB < estimatedFileMB * 4;
    return { usageMB, quotaMB, availableMB, isLow, supported: true };
  } catch {
    return { usageMB: 0, quotaMB: 0, availableMB: Infinity, isLow: false, supported: false };
  }
}
