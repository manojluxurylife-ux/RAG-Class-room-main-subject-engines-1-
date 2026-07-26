"use client";
/**
 * SaveToDriveModal — shown when a student's device is running low on
 * storage. Offers to save the material to the student's own Google Drive
 * instead of the device, with clear consent at each step (nothing happens
 * without an explicit click, and the Google account picker is Google's
 * own consent screen — we never see the student's Google credentials).
 */
import { useState } from "react";
import { HardDrive, Cloud, Loader2, CheckCircle, AlertTriangle, Download, X } from "lucide-react";
import { requestStudentDriveAccess, uploadToStudentDrive, isDriveConfigured } from "@/lib/student-drive";
import type { StorageStatus } from "@/lib/storage-check";

type Step = "ask" | "connecting" | "uploading" | "done" | "error";

interface Props {
  materialTitle: string;
  downloadUrl:   string;   // the same URL used for a normal device download
  suggestedFilename: string;
  storage:       StorageStatus;
  onClose:       () => void;
  onDownloadAnyway: () => void;
}

export function SaveToDriveModal({
  materialTitle, downloadUrl, suggestedFilename, storage, onClose, onDownloadAnyway,
}: Props) {
  const [step,  setStep]  = useState<Step>("ask");
  const [error, setError] = useState("");
  const [link,  setLink]  = useState("");

  async function saveToDrive() {
    setError("");
    try {
      setStep("connecting");
      const accessToken = await requestStudentDriveAccess();

      setStep("uploading");
      // Fetch the file into memory only — never written to device disk.
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Could not fetch the file.");
      const blob = await res.blob();
      const mimeType = res.headers.get("content-type") || blob.type || "application/octet-stream";

      const result = await uploadToStudentDrive(blob, suggestedFilename, mimeType, accessToken);
      setLink(result.webViewLink || "");
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-board3 bg-board2 p-5">

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-marigold" />
            <span className="font-display text-base text-chalk">Running low on space</span>
          </div>
          <button onClick={onClose} className="text-chalkdim hover:text-chalk"><X size={16} /></button>
        </div>

        {step === "ask" && (
          <>
            <p className="mb-1 text-sm text-chalkdim">
              Your device has about <b className="text-chalk">{Math.max(0, Math.round(storage.availableMB))} MB</b> free.
            </p>
            <p className="mb-4 text-sm text-chalkdim">
              Instead of filling up your phone, would you like to save
              <b className="text-chalk"> "{materialTitle}" </b>
              straight to your own Google Drive?
            </p>

            {isDriveConfigured() ? (
              <button onClick={saveToDrive}
                className="mb-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-board hover:bg-marigolddim">
                <Cloud size={14} /> Save to my Google Drive
              </button>
            ) : (
              <div className="mb-3 rounded-lg border border-board3 bg-board px-3 py-2 text-xs text-chalkdim">
                Google Drive saving isn't set up for this app yet.
              </div>
            )}

            <button onClick={onDownloadAnyway}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-board3 px-4 py-2.5 text-sm text-chalkdim hover:text-chalk hover:border-marigold/50">
              <Download size={14} /> Download to device anyway
            </button>
          </>
        )}

        {step === "connecting" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 size={24} className="animate-spin text-marigold" />
            <p className="text-sm text-chalkdim">Opening Google sign-in — choose the account you'd like to save to.</p>
          </div>
        )}

        {step === "uploading" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 size={24} className="animate-spin text-marigold" />
            <p className="text-sm text-chalkdim">Saving to your Drive…</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <CheckCircle size={28} className="text-marigold" />
            <p className="text-sm text-chalk">Saved to your Google Drive!</p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="text-xs text-marigold underline">
                Open in Drive
              </a>
            )}
            <button onClick={onClose}
              className="mt-2 w-full rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board hover:bg-marigolddim">
              Done
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <AlertTriangle size={26} className="text-terracotta" />
            <p className="text-sm text-terracotta">{error}</p>
            <div className="flex w-full gap-2">
              <button onClick={() => setStep("ask")}
                className="flex-1 rounded-lg border border-board3 px-4 py-2 text-sm text-chalkdim hover:text-chalk">
                Try again
              </button>
              <button onClick={onDownloadAnyway}
                className="flex-1 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-board hover:bg-marigolddim">
                Download instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
