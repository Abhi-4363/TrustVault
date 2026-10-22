import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, FileText, Lock, AlertCircle } from 'lucide-react';
import './TermsAndPrivacyModals.css';

export const TERMS_VERSION = '1.0.0';
export const PRIVACY_VERSION = '1.0.0';
export const POLICY_EFFECTIVE_DATE = 'October 22, 2026';

export function TermsAndPrivacyModals({
  isOpen,
  onClose,
  type = 'terms', // 'terms' | 'privacy'
  onSwitchType,
}) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus the close button for accessibility
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isTerms = type === 'terms';

  return (
    <div
      className="legal-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        className="legal-modal-container"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="legal-modal-header">
          <div className="legal-modal-header-info">
            <div className="legal-modal-badge">
              {isTerms ? <FileText size={16} /> : <ShieldCheck size={16} />}
              <span>
                {isTerms ? `Terms of Service v${TERMS_VERSION}` : `Privacy Policy v${PRIVACY_VERSION}`}
              </span>
            </div>
            <h2 id="legal-modal-title" className="legal-modal-title">
              {isTerms ? 'TrustVault Terms & Conditions' : 'TrustVault Privacy Policy'}
            </h2>
            <p className="legal-modal-effective">
              Effective Date: <strong>{POLICY_EFFECTIVE_DATE}</strong>
            </p>
          </div>

          <button
            type="button"
            className="legal-modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            ref={closeButtonRef}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs / Switcher */}
        <div className="legal-modal-nav">
          <button
            type="button"
            className={`legal-modal-nav-tab ${isTerms ? 'active' : ''}`}
            onClick={() => onSwitchType?.('terms')}
          >
            Terms & Conditions
          </button>
          <button
            type="button"
            className={`legal-modal-nav-tab ${!isTerms ? 'active' : ''}`}
            onClick={() => onSwitchType?.('privacy')}
          >
            Privacy Policy
          </button>
        </div>

        {/* Modal Content */}
        <div className="legal-modal-body">
          {isTerms ? (
            <div className="legal-content-flow">
              <div className="legal-notice-banner">
                <AlertCircle size={18} />
                <span>
                  Please read these Terms & Conditions carefully. TrustVault enforces strict cryptographic access controls, immutable audit records, and user permissions.
                </span>
              </div>

              <section className="legal-section">
                <h3>1. Acceptance of Terms</h3>
                <p>
                  By creating an account, accessing, or utilizing the TrustVault secure document management platform (&ldquo;TrustVault&rdquo; or the &ldquo;Service&rdquo;), you acknowledge that you have read, understood, and agreed to be legally bound by these Terms & Conditions and the incorporated Privacy Policy.
                </p>
              </section>

              <section className="legal-section">
                <h3>2. Eligibility and Account Registration</h3>
                <p>
                  To register for TrustVault, you must be at least thirteen (13) years of age or the applicable age of digital consent in your jurisdiction, whichever is higher. You agree to provide accurate, truthful, and complete information during registration, including your legitimate legal full name, a verifiable email address, and an accurate date of birth. TrustVault validates date of birth solely for age qualification and account security.
                </p>
              </section>

              <section className="legal-section">
                <h3>3. Account Accuracy and Security</h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities conducted under your account. You agree to immediately notify TrustVault administration of any unauthorized access, compromised credentials, or security incidents.
                </p>
              </section>

              <section className="legal-section">
                <h3>4. Password and Account Responsibility</h3>
                <p>
                  Passwords must satisfy TrustVault complexity rules (minimum 8 characters, including alphabetic and numeric characters). TrustVault protects passwords using industry-standard bcrypt cryptographic hashing and does not store or log plain-text passwords. You agree not to disclose your password to any third party.
                </p>
              </section>

              <section className="legal-section">
                <h3>5. Document Ownership and Authorized Use</h3>
                <p>
                  Users retain full intellectual property ownership of the documents, files, and intellectual content they upload to TrustVault. By uploading a document, you affirm that you possess the lawful right, license, or authorization to store and distribute that document within the system.
                </p>
              </section>

              <section className="legal-section">
                <h3>6. Document Upload and Prohibited Content</h3>
                <p>
                  You agree not to upload, store, or transmit through TrustVault any malicious files, viruses, malware, trojans, ransomware, or content that violates applicable intellectual property rights, privacy rights, or criminal statutes. All uploaded files are subject to magic-byte MIME verification and automated security inspection.
                </p>
              </section>

              <section className="legal-section">
                <h3>7. Document Sharing and Permissions</h3>
                <p>
                  TrustVault provides granular document visibility models:
                </p>
                <ul>
                  <li><strong>Private (Only Me):</strong> Accessible solely by the document owner, subject to authorized governance policies.</li>
                  <li><strong>Share with Specific Users:</strong> Accessible only to explicitly designated registered users with granted Read or Edit permissions.</li>
                  <li><strong>Share with All Registered Users:</strong> Accessible to authenticated, registered TrustVault members in accordance with organizational policies.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h3>8. Access Revocation and Permission Changes</h3>
                <p>
                  Document owners retain the authority to modify permission levels, downgrade edit access to read access, or revoke document access entirely at any time. Revocation takes effect immediately across all active sessions.
                </p>
              </section>

              <section className="legal-section">
                <h3>9. Audit Logs and Security Monitoring</h3>
                <p>
                  TrustVault maintains an immutable, tamper-evident audit log of significant actions, including document uploads, views, downloads, permission grants, access revocations, and profile modifications. Users acknowledge that system activity is recorded for forensic security, compliance verification, and vault integrity.
                </p>
              </section>

              <section className="legal-section">
                <h3>10. Acceptable Use and Prohibited Activities</h3>
                <p>
                  Users must not:
                </p>
                <ul>
                  <li>Attempt unauthorized access or privilege escalation (e.g., forging roles or administrative tokens).</li>
                  <li>Bypass document Access Control Lists (ACLs) or perimeter security controls.</li>
                  <li>Scrape, crawl, or harvest personal data or documents from other users.</li>
                  <li>Interfere with system availability, rate limits, or denial-of-service protections.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h3>11. Service Availability and Data Limitations</h3>
                <p>
                  TrustVault strives for high availability and resilient data storage. However, the Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of uninterrupted service. Users are advised to maintain independent backups of vital documents.
                </p>
              </section>

              <section className="legal-section">
                <h3>12. Security Incident Reporting</h3>
                <p>
                  If you discover a security vulnerability or suspect an unauthorized document disclosure, you agree to report it responsibly to the TrustVault security contact below without public disclosure or exploitation.
                </p>
              </section>

              <section className="legal-section">
                <h3>13. Account Suspension and Termination</h3>
                <p>
                  TrustVault reserves the right to suspend or terminate accounts that violate these Terms, engage in fraudulent behavior, or compromise the safety of other users or system infrastructure.
                </p>
              </section>

              <section className="legal-section">
                <h3>14. Changes to the Terms</h3>
                <p>
                  TrustVault may periodically update these Terms to reflect architectural improvements, legal requirements, or new features. When material changes occur, TrustVault will increment the terms version and require renewed acceptance upon subsequent authentication.
                </p>
              </section>

              <section className="legal-section">
                <h3>15. Contact and Support</h3>
                <p>
                  For inquiries regarding these Terms & Conditions or to report issues, contact the designated TrustVault representative:
                </p>
                <div className="legal-contact-box">
                  <p><strong>TrustVault Support & Legal Inquiries:</strong></p>
                  <p>Placeholder: <code>[TrustVault Legal Office, legal@trustvault.internal]</code></p>
                  <p>Physical Address Placeholder: <code>[TrustVault Operations Center, Corporate Facility Placeholder]</code></p>
                </div>
              </section>
            </div>
          ) : (
            <div className="legal-content-flow">
              <div className="legal-notice-banner">
                <Lock size={18} />
                <span>
                  Your privacy and document confidentiality are paramount. This policy details how TrustVault collects, protects, and handles your account and vault data.
                </span>
              </div>

              <section className="legal-section">
                <h3>1. Information We Collect</h3>
                <p>
                  TrustVault collects only the information necessary to provide and safeguard the Service:
                </p>
                <ul>
                  <li><strong>Account Registration Data:</strong> Full Name, Email Address, and Date of Birth.</li>
                  <li><strong>Authentication Credentials:</strong> Secure, salted bcrypt password hashes and single-use cryptographic tokens. Plain-text passwords are never stored.</li>
                  <li><strong>Document Metadata:</strong> File titles, descriptions, categories, file sizes, MIME types, and document ownership identifiers.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h3>2. Authentication and Account-Security Information</h3>
                <p>
                  We store cryptographic records of authentication tokens, password reset requests, and email verification states. IP addresses and browser fingerprints are not stored permanently or used for commercial profiling.
                </p>
              </section>

              <section className="legal-section">
                <h3>3. Document Metadata and Uploaded Document Storage</h3>
                <p>
                  Uploaded document contents are stored in protected repository directories accessible solely through authenticated backend APIs verifying granular ACL permissions.
                </p>
              </section>

              <section className="legal-section">
                <h3>4. Sharing Permissions and Audit Events</h3>
                <p>
                  TrustVault records document permission assignments (Read and Edit grants) and logs audit events containing actor identifiers, target document IDs, action types, and server-generated timestamps. Full dates of birth are omitted from audit log records to protect user privacy.
                </p>
              </section>

              <section className="legal-section">
                <h3>5. How Information is Used to Operate and Secure TrustVault</h3>
                <p>
                  We utilize collected information exclusively to:
                </p>
                <ul>
                  <li>Authenticate user identity and verify minimum-age eligibility (13+).</li>
                  <li>Enforce document ownership, viewing permissions, and editing rights.</li>
                  <li>Provide email notifications regarding account security and password recovery.</li>
                  <li>Prevent unauthorized access, credential stuffing, and malicious file uploads.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h3>6. Who Can Access Personal Information</h3>
                <p>
                  Your personal profile data is accessible only by you and authorized system administrators responsible for vault governance. Document contents are accessible only to you and registered users whom you explicitly authorize via document sharing settings.
                </p>
              </section>

              <section className="legal-section">
                <h3>7. Data Retention, Deletion, and Account Termination</h3>
                <p>
                  User data and uploaded documents are retained as long as your account remains active. Upon authorized account deletion or termination, uploaded documents owned by the account are permanently purged in accordance with data sanitation policies.
                </p>
              </section>

              <section className="legal-section">
                <h3>8. Security Measures and Limitations</h3>
                <p>
                  TrustVault employs defense-in-depth security measures:
                </p>
                <ul>
                  <li>Bcrypt password hashing with high work factors.</li>
                  <li>JWT cryptographically signed session tokens.</li>
                  <li>Input sanitation and XSS protection on profile fields.</li>
                  <li>Automated magic-byte file signature validation.</li>
                </ul>
                <p>
                  While we implement rigorous security controls, no internet-connected platform can guarantee absolute immunity from all threats. Users are encouraged to practice strong password hygiene.
                </p>
              </section>

              <section className="legal-section">
                <h3>9. User Rights and Profile Corrections</h3>
                <p>
                  Users have the continuous right to access, inspect, and correct their personal profile data. You can directly update your Full Name and Date of Birth at any time from your Account Profile settings.
                </p>
              </section>

              <section className="legal-section">
                <h3>10. Policy Versioning & Changes</h3>
                <p>
                  This Privacy Policy is versioned (currently <strong>v{PRIVACY_VERSION}</strong>). Any modifications will be posted with updated effective dates and will require acknowledgment as appropriate.
                </p>
              </section>

              <section className="legal-section">
                <h3>11. Contact and Privacy Inquiries</h3>
                <p>
                  For privacy inquiries, personal data requests, or compliance questions:
                </p>
                <div className="legal-contact-box">
                  <p><strong>TrustVault Privacy Office:</strong></p>
                  <p>Email Placeholder: <code>[privacy@trustvault.internal]</code></p>
                  <p>Data Protection Officer: <code>[TrustVault Privacy Team / Legal Department]</code></p>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="legal-modal-footer">
          <div className="legal-footer-note">
            <span>TrustVault Secure Document Vault &bull; Versioned Governance</span>
          </div>
          <button
            type="button"
            className="btn btn-primary legal-modal-done-btn"
            onClick={onClose}
          >
            I Understand &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TermsAndPrivacyModals;
