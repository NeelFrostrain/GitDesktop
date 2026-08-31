import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '../store/useSettingsStore';
import { Tabs } from '../../../components/common/Tabs';
import { Button } from '../../../components/common/Button';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
        {title}
      </h4>
      <div className="text-[11.5px] text-text-secondary leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <strong className="text-text-primary">{label}.</strong> {children}
    </p>
  );
}

function Bullet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">-</span>
      <span>
        <strong className="text-text-primary">{label}</strong> - {children}
      </span>
    </li>
  );
}

function TermsContent() {
  const support = import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com';
  return (
    <div className="space-y-5">
      <p className="text-[10.5px] text-text-muted">
        Last updated: August 2026 &nbsp;.&nbsp; Effective immediately upon installation
      </p>
      <Section title="1. Acceptance of Terms">
        By installing, launching, or using GitDesktop, you agree to be bound by these Terms. If you
        do not agree, do not use the Software.
      </Section>
      <Section title="2. License Grant">
        CyronicStudio grants you a personal, non-exclusive, non-transferable, revocable licence to
        install and run GitDesktop on devices you own or control, solely for lawful Git workflows.
        You may not sublicense, sell, rebrand, or distribute the Software without prior written
        consent.
      </Section>
      <Section title="3. Local-First Architecture">
        All Git operations are executed directly between your local machine and your chosen remote
        hosting provider. CyronicStudio does not proxy, intercept, or store your repository data.
      </Section>
      <Section title="4. Prohibited Uses">
        You agree not to use the Software to: (a) infringe third-party intellectual property rights;
        (b) transmit malware or destructive code; (c) circumvent authentication mechanisms; or
        (d) violate any applicable law or regulation.
      </Section>
      <Section title="5. User Responsibilities">
        <p>By using GitDesktop you accept sole responsibility for:</p>
        <ul className="mt-2 space-y-1.5 list-none">
          <Bullet label="Repository integrity">all commits, pushes, merges, and history rewrites performed through the Software.</Bullet>
          <Bullet label="Credential security">safeguarding your Personal Access Tokens, SSH keys, and OAuth sessions.</Bullet>
          <Bullet label="Access permissions">ensuring you have authorisation to access any remote repository via the Software.</Bullet>
          <Bullet label="Backups">maintaining your own backups of important repositories.</Bullet>
          <Bullet label="Compliance">ensuring your use complies with applicable licences, export controls, and organisational policies.</Bullet>
        </ul>
      </Section>
      <Section title="6. Third-Party Services">
        GitDesktop integrates with third-party Git hosting platforms and optional AI providers. Your
        use of those services is governed by their own terms. CyronicStudio is not responsible for
        third-party service availability, data handling, or outages.
      </Section>
      <Section title="7. Updates and Changes">
        Continued use after an update constitutes acceptance of the revised Terms. Material changes
        will be communicated via in-app notifications or our Discord server.
      </Section>
      <Section title="8. Disclaimer of Warranties">
        The Software is provided AS IS without warranties of any kind, express or implied.
        CyronicStudio does not warrant that the Software will be error-free or uninterrupted.
      </Section>
      <Section title="9. Limitation of Liability">
        To the fullest extent permitted by law, CyronicStudio shall not be liable for any indirect,
        incidental, special, or consequential damages arising from your use of the Software.
      </Section>
      <Section title="10. Contact">
        <p>
          For legal enquiries, contact{' '}
          <button
            type="button"
            onClick={() => openUrl('mailto:' + support)}
            className="text-commito-coral hover:underline cursor-pointer font-medium"
          >
            {support}
          </button>
          .
        </p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  const support = import.meta.env.VITE_CYRONIC_SUPPORT_EMAIL ?? 'support@cyronicstudio.com';
  return (
    <div className="space-y-5">
      <p className="text-[10.5px] text-text-muted">
        Last updated: August 2026 &nbsp;.&nbsp; Effective immediately upon installation
      </p>
      <Section title="1. Our Commitment">
        CyronicStudio built GitDesktop as a local-first developer tool. Your code, repositories, and
        workflows are yours alone.
      </Section>
      <Section title="2. What We Never Collect">
        <ul className="space-y-1.5 list-none">
          <Bullet label="Source code">we never read, copy, transmit, or store your code or repository content.</Bullet>
          <Bullet label="Commit history and diffs">your commit messages, diffs, and branch history stay on your machine.</Bullet>
          <Bullet label="Credentials">passwords, tokens, SSH keys, and OAuth tokens are stored in your OS keyring only.</Bullet>
          <Bullet label="Repository metadata">remote URLs, branch names, and contributor identities are not logged.</Bullet>
        </ul>
      </Section>
      <Section title="3. What We Do Collect">
        <Item label="Anonymous heartbeat">
          On app launch, a single anonymous ping is sent containing only a randomly-generated client
          ID, app version, and OS platform. No personally identifiable information is included.
        </Item>
        <Item label="Onboarding registration (optional)">
          During first-run onboarding, if you provide your name and email, these are sent once to
          help us track new downloads. This is entirely optional and never linked to your Git
          activity.
        </Item>
      </Section>
      <Section title="4. AI Features and Google Gemini">
        <Item label="Data flow">
          When you use AI commit message generation, a summary of your staged diff is sent directly
          from your machine to the Google Gemini API. CyronicStudio does not route, log, or store
          this data.
        </Item>
        <Item label="API key storage">
          Your Gemini API key is stored locally and never transmitted to CyronicStudio.
        </Item>
      </Section>
      <Section title="5. Data Retention">
        The anonymous client ID is stored in local storage and cleared on uninstall. We do not
        retain server-side logs tied to individual users beyond 30 days of aggregated analytics.
      </Section>
      <Section title="6. Contact">
        <p>
          Privacy questions or data deletion requests:{' '}
          <button
            type="button"
            onClick={() => openUrl('mailto:' + support)}
            className="text-commito-coral hover:underline cursor-pointer font-medium"
          >
            {support}
          </button>
          .
        </p>
      </Section>
    </div>
  );
}


export const LegalTab: React.FC = () => {
  const { selectedSubcategory } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(
    selectedSubcategory === 'Privacy Policy' ? 'privacy' : 'terms'
  );

  React.useEffect(() => {
    if (selectedSubcategory === 'Privacy Policy') setActiveTab('privacy');
    else if (selectedSubcategory === 'Terms of Service') setActiveTab('terms');
  }, [selectedSubcategory]);

  return (
    <div className="flex flex-col h-full gap-3 select-none font-sans">
      <div className="shrink-0">
        <Tabs<'terms' | 'privacy'>
          tabs={[
            { id: 'terms', label: 'Terms of Service' },
            { id: 'privacy', label: 'Privacy Policy' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          size="sm"
          variant="segmented"
        />
      </div>
      <div className="flex-1 min-h-0 p-4 rounded-sm border border-border/80 bg-base-1/50 shadow-2xs overflow-y-auto select-text">
        {activeTab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <Button
          type="button"
          variant="secondary"
          size="xs"
          rightIcon={<ExternalLink className="w-3 h-3 text-text-muted" />}
          onClick={() => openUrl(import.meta.env.VITE_CYRONIC_WEBSITE_URL ?? 'https://cyronicstudio.com/terms')}
        >
          cyronicstudio.com/terms
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          rightIcon={<ExternalLink className="w-3 h-3 text-text-muted" />}
          onClick={() => openUrl(import.meta.env.VITE_CYRONIC_DISCORD_URL ?? 'https://discord.gg/cyronicstudio')}
        >
          Discord Server
        </Button>
      </div>
    </div>
  );
};
