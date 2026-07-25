export const publicSiteConfig = {
  productName: "Qaffel",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null,
  supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || null
} as const;

export const legalReviewNotice = "This page is provided for product transparency and requires final operator and legal review before an unrestricted public launch.";
