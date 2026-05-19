/**
 * TempoSwap — Centralized SVG Icon Library
 * ─────────────────────────────────────────
 * Lucide-style inline SVGs. 24x24 viewBox, stroke-based, 2px stroke.
 * Zero external dependencies.
 */

const D = { size: 18, color: 'currentColor' };
const svg = (p, d) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={p.size||D.size} height={p.size||D.size} viewBox="0 0 24 24" fill="none" stroke={p.color||D.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={p.style}>{d}</svg>
);

// ─── Navigation Icons ──────────────────────────────────────────────────────────
export const SwapIcon = (p={}) => svg(p, <><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></>);

export const OrdersIcon = (p={}) => svg(p, <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/><line x1="7" y1="16" x2="11" y2="16"/></>);

export const EarnIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15.5 9.5c0-1.38-1.57-2.5-3.5-2.5S8.5 8.12 8.5 9.5c0 1.38 1.57 2.5 3.5 2.5s3.5 1.12 3.5 2.5c0 1.38-1.57 2.5-3.5 2.5s-3.5-1.12-3.5-2.5"/></>);

export const WalletIcon = (p={}) => svg(p, <><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 14h2"/></>);

export const HistoryIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>);

export const TrophyIcon = (p={}) => svg(p, <><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M6 3h12v7a6 6 0 0 1-12 0V3z"/><path d="M9 21h6"/><path d="M12 16v5"/></>);

export const BookIcon = (p={}) => svg(p, <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></>);

export const InfoIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>);

export const KeyIcon = (p={}) => svg(p, <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 0-7.78 7.78 5.5 5.5 0 0 0 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>);

// ─── Wallet Modal Icons ────────────────────────────────────────────────────────
export const FoxIcon = (p={}) => svg(p, <><path d="M21 3L13.5 10.5"/><path d="M3 3l7.5 7.5"/><path d="M12 12l-3.5 9L12 18.5 15.5 21 12 12z"/><path d="M3 3l5.5 5.5"/><path d="M21 3l-5.5 5.5"/><path d="M8.5 8.5L3 15l5.5 6"/><path d="M15.5 8.5L21 15l-5.5 6"/></>);

export const ShieldIcon = (p={}) => svg(p, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></>);

export const GlobeIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>);

export const PlugIcon = (p={}) => svg(p, <><path d="M12 22v-5"/><path d="M9 8V1h6v7"/><path d="M7 8h10a2 2 0 0 1 2 2v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2z"/></>);

// ─── Status Icons ──────────────────────────────────────────────────────────────
export const AlertCircleIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>);

export const CheckCircleIcon = (p={}) => svg(p, <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>);

export const CheckIcon = (p={}) => svg(p, <><polyline points="20 6 9 17 4 12"/></>);

export const XCircleIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>);

export const WarningIcon = (p={}) => svg(p, <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>);

// ─── Action Icons ──────────────────────────────────────────────────────────────
export const DropletIcon = (p={}) => svg(p, <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>);

export const LinkIcon = (p={}) => svg(p, <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>);

export const CopyIcon = (p={}) => svg(p, <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>);

export const RefreshIcon = (p={}) => svg(p, <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>);

export const ExternalLinkIcon = (p={}) => svg(p, <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>);

export const SearchIcon = (p={}) => svg(p, <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>);

export const SettingsIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>);

// ─── Trade Icons ───────────────────────────────────────────────────────────────
export const ArrowDownIcon = (p={}) => svg(p, <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>);

export const ArrowUpDownIcon = (p={}) => svg(p, <><line x1="12" y1="3" x2="12" y2="21"/><polyline points="7 8 12 3 17 8"/><polyline points="17 16 12 21 7 16"/></>);

export const ChevronDownIcon = (p={}) => svg(p, <><polyline points="6 9 12 15 18 9"/></>);

export const TrendUpIcon = (p={}) => svg(p, <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>);

export const TrendDownIcon = (p={}) => svg(p, <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>);

// ─── DeFi Icons ────────────────────────────────────────────────────────────────
export const CoinsIcon = (p={}) => svg(p, <><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88l.7.71-2.82 2.82"/></>);

export const LockIcon = (p={}) => svg(p, <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>);

export const UnlockIcon = (p={}) => svg(p, <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>);

export const GiftIcon = (p={}) => svg(p, <><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>);

export const ZapIcon = (p={}) => svg(p, <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>);

// ─── Social Icons ──────────────────────────────────────────────────────────────
export const TwitterIcon = (p={}) => svg(p, <><path d="M4 4l11.733 16h4.267l-11.733-16zM4 20l6.768-6.768M20 4l-6.768 6.768"/></>);

export const GithubIcon = (p={}) => svg(p, <><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></>);

export const DiscordIcon = (p={}) => svg(p, <><path d="M9.09 9a3 3 0 0 0-2.83 2c-.22.65-.22 1.35 0 2a3 3 0 0 0 2.83 2"/><path d="M14.91 9a3 3 0 0 1 2.83 2c.22.65.22 1.35 0 2a3 3 0 0 1-2.83 2"/><path d="M7.5 4.21l-.77-.77a2 2 0 0 0-2.83 0L2.24 5.1a2 2 0 0 0 0 2.83l.66.67"/><path d="M16.5 4.21l.77-.77a2 2 0 0 1 2.83 0l1.66 1.66a2 2 0 0 1 0 2.83l-.66.67"/><path d="M8 17s1.5 2 4 2 4-2 4-2"/><path d="M5 11v4a7 7 0 0 0 14 0v-4"/></>);

export const TelegramIcon = (p={}) => svg(p, <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>);

// ─── Misc Icons ────────────────────────────────────────────────────────────────
export const SunIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>);

export const UsersIcon = (p={}) => svg(p, <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>);

export const LayersIcon = (p={}) => svg(p, <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>);

export const ShieldCheckIcon = (p={}) => svg(p, <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></>);

export const ActivityIcon = (p={}) => svg(p, <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>);

export const StarIcon = (p={}) => svg(p, <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>);

export const HashIcon = (p={}) => svg(p, <><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></>);

export const BarChartIcon = (p={}) => svg(p, <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>);

export const PlusCircleIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>);

export const MinusCircleIcon = (p={}) => svg(p, <><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></>);

export const LogOutIcon = (p={}) => svg(p, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>);
