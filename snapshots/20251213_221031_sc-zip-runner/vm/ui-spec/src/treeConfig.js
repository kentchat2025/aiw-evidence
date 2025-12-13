// src/treeConfig.js
// Canonical SAP-style tree config for FounderConsole Root UI

const founderConsoleTree = [
  {
    id: "1",
    label: "Root – FounderConsole",
    path: "/",
    children: [
      {
        id: "1.1",
        label: "Home & Overview",
        path: "/home",
        children: [
          {
            id: "1.1.1",
            label: "Founder Home Dashboard",
            path: "/home/founder-dashboard",
          },
          {
            id: "1.1.2",
            label: "Global Project Snapshot",
            path: "/home/global-snapshot",
          },
          {
            id: "1.1.3",
            label: "AI Advisor – Next Best Actions",
            path: "/home/ai-advisor",
          },
        ],
      },

      // 2 – AI Wealth Generator
      {
        id: "2",
        label: "AI Wealth Generator",
        path: "/ai-wealth",
        children: [
          {
            id: "2.1",
            label: "Dashboards & Status",
            path: "/ai-wealth/dashboards",
            children: [
              {
                id: "2.1.1",
                label: "Control Run Status",
                path: "/ai-wealth/dashboards/control-run",
              },
              {
                id: "2.1.2",
                label: "Portfolio & PnL",
                path: "/ai-wealth/dashboards/portfolio-pnl",
              },
              {
                id: "2.1.3",
                label: "Risk & Guardrails",
                path: "/ai-wealth/dashboards/risk-guardrails",
              },
              {
                id: "2.1.4",
                label: "Broker Connectivity",
                path: "/ai-wealth/dashboards/brokers",
              },
            ],
          },
          {
            id: "2.2",
            label: "Control Runs & Approvals",
            path: "/ai-wealth/control-runs",
            children: [
              {
                id: "2.2.1",
                label: "Control Run Queue",
                path: "/ai-wealth/control-runs/queue",
              },
              {
                id: "2.2.2",
                label: "Daily Creamy Layer",
                path: "/ai-wealth/control-runs/creamy-layer",
              },
              {
                id: "2.2.3",
                label: "Manual Approvals",
                path: "/ai-wealth/control-runs/manual-approvals",
              },
              {
                id: "2.2.4",
                label: "Auto vs Manual Modes",
                path: "/ai-wealth/control-runs/modes",
              },
            ],
          },
          {
            id: "2.3",
            label: "Configuration & Policies",
            path: "/ai-wealth/config",
            children: [
              {
                id: "2.3.1",
                label: "Profiles & Risk Buckets",
                path: "/ai-wealth/config/profiles",
              },
              {
                id: "2.3.2",
                label: "Capital Allocation Rules",
                path: "/ai-wealth/config/capital-rules",
              },
              {
                id: "2.3.3",
                label: "Instrument Universe",
                path: "/ai-wealth/config/universe",
              },
              {
                id: "2.3.4",
                label: "Broker Setup",
                path: "/ai-wealth/config/broker-setup",
              },
            ],
          },
        ],
      },

      // 3 – ERP AI Intelligence
      {
        id: "3",
        label: "ERP AI Intelligence",
        path: "/erp-ai",
        children: [
          {
            id: "3.1",
            label: "Insight Bot",
            path: "/erp-ai/insight-bot",
          },
          {
            id: "3.2",
            label: "Connectors & Data Sources",
            path: "/erp-ai/connectors",
          },
          {
            id: "3.3",
            label: "Blueprints & Automation",
            path: "/erp-ai/blueprints",
          },
        ],
      },

      // 4 – Price Engine
      {
        id: "4",
        label: "Price Engine",
        path: "/price-engine",
        children: [
          {
            id: "4.1",
            label: "Dashboards",
            path: "/price-engine/dashboards",
          },
          {
            id: "4.2",
            label: "Rules & Strategies",
            path: "/price-engine/strategies",
          },
        ],
      },

      // 5 – Pricing Genie
      {
        id: "5",
        label: "Pricing Genie",
        path: "/pricing-genie",
        children: [
          {
            id: "5.1",
            label: "Market Comparison",
            path: "/pricing-genie/comparison",
          },
          {
            id: "5.2",
            label: "Offer & Campaign Suggestions",
            path: "/pricing-genie/offers",
          },
        ],
      },

      // 6 – Digital Marketing Agent
      {
        id: "6",
        label: "Digital Marketing Agent",
        path: "/digital-marketing",
        children: [
          {
            id: "6.1",
            label: "Channel Dashboards",
            path: "/digital-marketing/channels",
          },
          {
            id: "6.2",
            label: "Campaign Orchestrator",
            path: "/digital-marketing/orchestrator",
          },
          {
            id: "6.3",
            label: "Content & Creatives",
            path: "/digital-marketing/creatives",
          },
        ],
      },

      // 7 – Supercoder & Infra
      {
        id: "7",
        label: "Supercoder & Infra",
        path: "/supercoder",
        children: [
          {
            id: "7.1",
            label: "Deployments & Zips",
            path: "/supercoder/deployments",
          },
          {
            id: "7.2",
            label: "Health & Observability",
            path: "/supercoder/observability",
          },
          {
            id: "7.3",
            label: "Self-Heal & Self-Upgrade",
            path: "/supercoder/self-heal",
          },
        ],
      },

      // 8 – FounderConsole Governance
      {
        id: "8",
        label: "FounderConsole Governance",
        path: "/governance",
        children: [
          {
            id: "8.1",
            label: "AI Constitution",
            path: "/governance/ai-constitution",
          },
          {
            id: "8.2",
            label: "Policies & Guardrails",
            path: "/governance/policies",
          },
          {
            id: "8.3",
            label: "Audit & Logs",
            path: "/governance/audit",
          },
        ],
      },

      // 9 – Pain Points & Monetization
      {
        id: "9",
        label: "Pain Points & Monetization",
        path: "/pain-monetization",
        children: [
          {
            id: "9.1",
            label: "Pain Point Backlog",
            path: "/pain-monetization/backlog",
          },
          {
            id: "9.2",
            label: "Monetization Blueprints",
            path: "/pain-monetization/blueprints",
          },
          {
            id: "9.3",
            label: "ROI & Experiments",
            path: "/pain-monetization/roi",
          },
        ],
      },

      // 10 – Licensing & Billing
      {
        id: "10",
        label: "Licensing & Billing",
        path: "/licensing",
        children: [
          {
            id: "10.1",
            label: "Plans & Tiers",
            path: "/licensing/plans",
          },
          {
            id: "10.2",
            label: "Razorpay & Payments",
            path: "/licensing/payments",
          },
          {
            id: "10.3",
            label: "Usage & ROI per Plan",
            path: "/licensing/roi",
          },
        ],
      },

      // 11 – AI Brain & Analytics
      {
        id: "11",
        label: "AI Brain & Analytics",
        path: "/ai-brain",
        children: [
          {
            id: "11.1",
            label: "User / Org Brain Memory",
            path: "/ai-brain/brain-memory",
          },
          {
            id: "11.2",
            label: "Cross-Project Intelligence Hub",
            path: "/ai-brain/cross-project",
          },
          {
            id: "11.3",
            label: "Reports & Downloads",
            path: "/ai-brain/reports",
          },
        ],
      },

      // 12 – Settings
      {
        id: "12",
        label: "Settings",
        path: "/settings",
        children: [
          {
            id: "12.1",
            label: "Notifications (Email / WhatsApp)",
            path: "/settings/notifications",
          },
          {
            id: "12.2",
            label: "Theme & Branding (KenTechIT)",
            path: "/settings/theme-branding",
          },
          {
            id: "12.3",
            label: "User Management",
            path: "/settings/users",
          },
          {
            id: "12.4",
            label: "Security & Compliance",
            path: "/settings/security-compliance",
          },
        ],
      },
    ],
  },
];

export default founderConsoleTree;

