import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Avenli handles your information." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="This policy explains what Avenli collects, why it is used, and the choices available to you.">
      <section><h2>Information we handle</h2><p>We store the account details you provide, including your email address, display name and preferences. We also store the problems, constraints, responses, plans and other workspace content you submit, along with service logs needed to keep Avenli reliable and secure.</p></section>
      <section><h2>How we use information</h2><p>We use this information to authenticate you, provide and improve Avenli, research the problems you submit, generate recommendations, monitor requested follow-up work, prevent abuse and support account requests.</p></section>
      <section><h2>Service providers</h2><p>Avenli uses service providers for hosting, authentication, database storage, email delivery, web research and AI processing. Information is shared with them only as needed to operate the requested feature. Your submissions may be processed in countries outside your own under the provider’s applicable safeguards.</p></section>
      <section><h2>Retention and security</h2><p>We retain account and workspace data while your account is active and as reasonably needed for security, legal obligations and service recovery. We use access controls and encrypted connections, but no online service can promise absolute security.</p></section>
      <section><h2>Your choices</h2><p>You can update your profile, export your account data and request permanent account deletion from Settings. You may also contact us to ask about access, correction or deletion. Some limited records may be retained where required by law or necessary to protect the service.</p></section>
      <section><h2>Contact</h2><p>For privacy questions, contact <a href="mailto:j.kaczmarczyk96@gmail.com">j.kaczmarczyk96@gmail.com</a>.</p></section>
    </LegalPage>
  );
}
