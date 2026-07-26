import { redirect } from "next/navigation";

// Superseded by the real Messages inbox — kept as a redirect so any
// bookmarked/old links still land somewhere useful.
export default function AdminSupportRedirect() {
  redirect("/admin/messages");
}
