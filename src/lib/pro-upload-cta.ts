export type ProUploadCtaDetail = {
  server?: "cloudinary" | "bunny" | "planethoster" | "nexus";
  label?: string;
  reason?: string;
};

export function openProUploadCta(detail?: ProUploadCtaDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pro-upload-cta", { detail }));
}
