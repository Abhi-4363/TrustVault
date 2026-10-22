/**
 * TrustVault — Enterprise Demonstration Records
 *
 * All data in this file is structured demonstration data created to illustrate
 * UI hierarchy, accessibility, and visual presentation.
 */

export const DEMO_METRICS = {
  totalDocuments: {
    label: 'Total documents',
    value: 24,
    description: 'Active files stored in vault',
    trend: '+3 this week',
    isDemo: true,
  },
  sharedWithOthers: {
    label: 'Shared with others',
    value: 9,
    description: 'Documents with active outbound permissions',
    trend: '2 pending reviews',
    isDemo: true,
  },
  sharedWithMe: {
    label: 'Shared with me',
    value: 6,
    description: 'Received read or edit permissions',
    trend: 'All permissions verified',
    isDemo: true,
  },
  recentActivities: {
    label: 'Recent audit events',
    value: 38,
    description: 'Logged actions in past 7 days',
    trend: '100% audit integrity',
    isDemo: true,
  },
};

export const DEMO_DOCUMENTS = [
  {
    id: 'doc-001',
    name: 'Q3_Financial_Audit_Report_2026.pdf',
    description: 'Quarterly compliance and balance sheet audit review',
    fileType: 'PDF',
    fileSize: '4.2 MB',
    owner: {
      name: 'Sarah Jenkins',
      email: 'sarah.j@acmecorp.internal',
      initials: 'SJ',
    },
    lastUpdated: '2026-10-18T14:30:00Z',
    formattedDate: 'Oct 18, 2026',
    accessLevel: 'Owner', // Owner, Edit, Read
    sharedCount: 3,
    status: 'Restricted',
  },
  {
    id: 'doc-002',
    name: 'Master_Services_Agreement_Final.docx',
    description: 'Standard enterprise customer service level terms and conditions',
    fileType: 'DOCX',
    fileSize: '1.8 MB',
    owner: {
      name: 'Marcus Chen',
      email: 'm.chen@acmecorp.internal',
      initials: 'MC',
    },
    lastUpdated: '2026-10-17T09:15:00Z',
    formattedDate: 'Oct 17, 2026',
    accessLevel: 'Can Edit',
    sharedCount: 5,
    status: 'Shared',
  },
  {
    id: 'doc-003',
    name: 'Security_Architecture_Whitepaper_v2.pdf',
    description: 'Zero-trust network topology and data classification specification',
    fileType: 'PDF',
    fileSize: '6.7 MB',
    owner: {
      name: 'Alex Rivera',
      email: 'alex.r@acmecorp.internal',
      initials: 'AR',
    },
    lastUpdated: '2026-10-15T16:45:00Z',
    formattedDate: 'Oct 15, 2026',
    accessLevel: 'Can Read',
    sharedCount: 8,
    status: 'Confidential',
  },
  {
    id: 'doc-004',
    name: 'FY2027_Board_Meeting_Deck.pdf',
    description: 'Confidential executive roadmap and financial projections',
    fileType: 'PDF',
    fileSize: '12.4 MB',
    owner: {
      name: 'Sarah Jenkins',
      email: 'sarah.j@acmecorp.internal',
      initials: 'SJ',
    },
    lastUpdated: '2026-10-14T11:20:00Z',
    formattedDate: 'Oct 14, 2026',
    accessLevel: 'Owner',
    sharedCount: 2,
    status: 'Restricted',
  },
  {
    id: 'doc-005',
    name: 'Vendor_Due_Diligence_Checklist.xlsx',
    description: 'Annual vendor risk matrix and compliance verification criteria',
    fileType: 'XLSX',
    fileSize: '890 KB',
    owner: {
      name: 'Priya Sharma',
      email: 'priya.s@acmecorp.internal',
      initials: 'PS',
    },
    lastUpdated: '2026-10-12T08:50:00Z',
    formattedDate: 'Oct 12, 2026',
    accessLevel: 'Can Read',
    sharedCount: 4,
    status: 'Shared',
  },
];

export const DEMO_ACTIVITIES = [
  {
    id: 'act-101',
    type: 'upload',
    actor: {
      name: 'Sarah Jenkins',
      initials: 'SJ',
    },
    documentName: 'Q3_Financial_Audit_Report_2026.pdf',
    actionText: 'uploaded document',
    timestamp: '2 hours ago',
    formattedDate: 'Oct 20, 2026, 07:15 AM',
    badgeVariant: 'success',
  },
  {
    id: 'act-102',
    type: 'grant',
    actor: {
      name: 'Marcus Chen',
      initials: 'MC',
    },
    targetUser: 'David Miller',
    documentName: 'Master_Services_Agreement_Final.docx',
    actionText: 'granted Edit permission to David Miller on',
    timestamp: '5 hours ago',
    formattedDate: 'Oct 20, 2026, 04:30 AM',
    badgeVariant: 'primary',
  },
  {
    id: 'act-103',
    type: 'update',
    actor: {
      name: 'Alex Rivera',
      initials: 'AR',
    },
    documentName: 'Security_Architecture_Whitepaper_v2.pdf',
    actionText: 'updated metadata on',
    timestamp: 'Yesterday',
    formattedDate: 'Oct 19, 2026, 03:10 PM',
    badgeVariant: 'info',
  },
  {
    id: 'act-104',
    type: 'revoke',
    actor: {
      name: 'Sarah Jenkins',
      initials: 'SJ',
    },
    targetUser: 'Contractor Team',
    documentName: 'FY2027_Board_Meeting_Deck.pdf',
    actionText: 'immediately revoked Read access from Contractor Team on',
    timestamp: '2 days ago',
    formattedDate: 'Oct 18, 2026, 06:00 PM',
    badgeVariant: 'danger',
  },
];
