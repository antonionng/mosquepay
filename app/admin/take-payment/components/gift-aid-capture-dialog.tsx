// Re-export of the canonical paper Gift Aid upload dialog, kept here so
// existing take-payment imports keep working after the dialog moved to
// components/admin/. New code should import from
// `@/components/admin/gift-aid-paper-upload-dialog` directly.

export {
  GiftAidPaperUploadDialog as GiftAidCaptureDialog,
  type GiftAidDefaultAddress,
} from "@/components/admin/gift-aid-paper-upload-dialog";
