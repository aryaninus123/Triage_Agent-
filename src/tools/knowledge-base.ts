import type { KBArticle, KBSearchResult, TicketCategory } from "../types";

interface KBSearchInput {
  category: TicketCategory;
  keywords: string[];
}

interface RawArticle {
  id: string;
  title: string;
  url: string;
  snippet: string;
  tags: string[];
}

// Mock knowledge base — in production this would query Elasticsearch, Notion, Confluence, etc.
const KB_ARTICLES: Record<TicketCategory, RawArticle[]> = {
  billing: [
    {
      id: "KB-B001",
      title: "Understanding Your Invoice and Billing Cycle",
      url: "/kb/billing/invoice-guide",
      snippet: "Your billing cycle starts on the date you first subscribed. Charges appear within 24h of renewal.",
      tags: ["invoice", "charge", "subscription", "billing", "cycle"],
    },
    {
      id: "KB-B002",
      title: "How to Request a Refund",
      url: "/kb/billing/refund-policy",
      snippet: "Refund requests within 14 days of charge are processed automatically. Contact support for older charges.",
      tags: ["refund", "charge", "duplicate", "credit", "money"],
    },
    {
      id: "KB-B003",
      title: "Updating Your Payment Method",
      url: "/kb/billing/payment-methods",
      snippet: "You can update your credit card or switch to annual billing in Settings → Billing.",
      tags: ["payment", "card", "credit", "update", "billing"],
    },
  ],
  technical: [
    {
      id: "KB-T001",
      title: "Troubleshooting a Blank Dashboard",
      url: "/kb/technical/blank-dashboard",
      snippet: "A blank dashboard is usually caused by a browser cache issue or a recent update conflict. Try a hard refresh (Ctrl+Shift+R).",
      tags: ["dashboard", "blank", "loading", "white screen", "browser", "cache"],
    },
    {
      id: "KB-T002",
      title: "Supported Browsers and OS Versions",
      url: "/kb/technical/browser-support",
      snippet: "We support Chrome 110+, Firefox 110+, Edge 110+, and Safari 16+. Internet Explorer is not supported.",
      tags: ["browser", "chrome", "firefox", "safari", "compatibility", "os"],
    },
    {
      id: "KB-T003",
      title: "How to Clear Your Cache and Cookies",
      url: "/kb/technical/clear-cache",
      snippet: "Step-by-step instructions for clearing cache in Chrome, Firefox, and Safari to resolve display issues.",
      tags: ["cache", "cookies", "clear", "browser", "fix", "troubleshoot"],
    },
  ],
  refund: [
    {
      id: "KB-R001",
      title: "Refund Policy Overview",
      url: "/kb/billing/refund-policy",
      snippet: "Full refunds are available within 14 days of purchase. Pro-rated refunds are available for annual plans.",
      tags: ["refund", "policy", "money", "cancel", "charge"],
    },
    {
      id: "KB-R002",
      title: "Disputing a Charge",
      url: "/kb/billing/dispute-charge",
      snippet: "If you see an unexpected charge, submit a dispute within 60 days. Include your order ID for faster processing.",
      tags: ["dispute", "charge", "unexpected", "fraud", "billing"],
    },
  ],
  shipping: [
    {
      id: "KB-S001",
      title: "Tracking Your Order",
      url: "/kb/shipping/order-tracking",
      snippet: "Once shipped, you'll receive a tracking number via email. Orders typically arrive within 5–7 business days.",
      tags: ["tracking", "order", "shipping", "delivery", "status"],
    },
    {
      id: "KB-S002",
      title: "Changing a Delivery Address",
      url: "/kb/shipping/change-address",
      snippet: "You can update a delivery address up to 24 hours after placing the order by contacting support.",
      tags: ["address", "delivery", "change", "shipping", "update"],
    },
  ],
  account: [
    {
      id: "KB-A001",
      title: "Resetting Your Password",
      url: "/kb/account/reset-password",
      snippet: "Use the 'Forgot Password' link on the login page. The reset link expires in 24 hours.",
      tags: ["password", "reset", "login", "access", "forgot"],
    },
    {
      id: "KB-A002",
      title: "Managing Team Members and Permissions",
      url: "/kb/account/team-management",
      snippet: "Admins can add or remove team members under Settings → Team. Seat limits depend on your plan.",
      tags: ["team", "member", "permission", "admin", "seats", "invite"],
    },
    {
      id: "KB-A003",
      title: "Two-Factor Authentication Setup",
      url: "/kb/account/2fa",
      snippet: "Enable 2FA under Settings → Security. We support TOTP apps like Authy and Google Authenticator.",
      tags: ["2fa", "security", "authentication", "two-factor", "login"],
    },
  ],
  general: [
    {
      id: "KB-G001",
      title: "Exporting Your Data",
      url: "/kb/general/data-export",
      snippet: "Export all your data as CSV or JSON from Settings → Data → Export. Large exports may take a few minutes.",
      tags: ["export", "data", "csv", "json", "download", "backup"],
    },
    {
      id: "KB-G002",
      title: "Getting Started Guide",
      url: "/kb/general/getting-started",
      snippet: "New to the platform? Follow this step-by-step guide to set up your workspace and invite your team.",
      tags: ["getting started", "setup", "onboarding", "guide", "new"],
    },
    {
      id: "KB-G003",
      title: "Integrations Overview",
      url: "/kb/general/integrations",
      snippet: "Connect with Slack, Jira, GitHub, and 50+ other tools via the Integrations panel in Settings.",
      tags: ["integration", "slack", "jira", "github", "connect", "api"],
    },
  ],
};

function scoreArticle(article: RawArticle, keywords: string[]): number {
  const normalizedKeywords = keywords.map((k) => k.toLowerCase());
  let score = 0;
  for (const tag of article.tags) {
    for (const kw of normalizedKeywords) {
      if (tag.includes(kw) || kw.includes(tag)) {
        score++;
      }
    }
  }
  return score;
}

export function searchKnowledgeBase(input: KBSearchInput): KBSearchResult {
  const categoryArticles = KB_ARTICLES[input.category] ?? KB_ARTICLES.general;

  const scored = categoryArticles
    .map((article) => ({
      ...article,
      relevanceScore: scoreArticle(article, input.keywords),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3);

  // Normalize relevance scores to 0.0–1.0
  const maxScore = Math.max(...scored.map((a) => a.relevanceScore), 1);
  const articles: KBArticle[] = scored.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    snippet: a.snippet,
    relevanceScore: Math.round((a.relevanceScore / maxScore) * 100) / 100,
  }));

  return {
    articles,
    searchedFor: input.keywords.join(", "),
  };
}
