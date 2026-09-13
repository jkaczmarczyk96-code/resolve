import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: "Terms for using Avenli." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro="These terms govern your use of Avenli during its early-access period.">
      <section><h2>Using Avenli</h2><p>You must provide accurate account information, keep your account secure and use the service lawfully. You are responsible for the content you submit and must have the right to use it. Do not use Avenli to harm others, violate rights, distribute malicious software or interfere with the service.</p></section>
      <section><h2>Recommendations and actions</h2><p>Avenli uses automated systems to research and organize possible solutions. Results can be incomplete, outdated or wrong. Review sources and recommendations before relying on them, especially for medical, legal, financial, safety-critical or other high-impact decisions. You remain responsible for decisions and actions taken from the output.</p></section>
      <section><h2>Early access</h2><p>Features may change, fail or be withdrawn while Avenli is in early access. The service is provided without a guarantee of uninterrupted availability or fitness for a particular purpose, to the extent permitted by law.</p></section>
      <section><h2>Your content</h2><p>You keep ownership of your content. You grant Avenli permission to process it only as needed to provide, secure and improve the service. You can export your data or delete your account from Settings.</p></section>
      <section><h2>Suspension and termination</h2><p>Access may be limited or ended when reasonably necessary to protect users, comply with law or address misuse. You may stop using Avenli and delete your account at any time.</p></section>
      <section><h2>Contact</h2><p>For questions about these terms, contact <a href="mailto:j.kaczmarczyk96@gmail.com">j.kaczmarczyk96@gmail.com</a>.</p></section>
    </LegalPage>
  );
}
