"use client";

// ═══════════════════════════════════════════════════════════════════
// AI Provider Logo 组件
// 使用 SVG 渲染各 Provider 的品牌标识
// ═══════════════════════════════════════════════════════════════════

interface ProviderLogoProps {
    provider: string;
    size?: number;
    className?: string;
}

export function ProviderLogo({ provider, size = 18, className = "" }: ProviderLogoProps) {
    switch (provider) {
        case "anthropic":
            return (
                <svg viewBox="0 0 256 176" width={size} height={size} className={className}>
                    <path d="M147.487 0H108.44l74.3 175.896h39.049L147.487 0ZM34.211 0 0 87.267l19.494 46.14L53.737 39.05l72.552 136.847H165.34L34.211 0Z" fill="currentColor" />
                </svg>
            );
        case "openai":
        case "codex":
            return (
                <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
                    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.79a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.666zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
                </svg>
            );
        case "gemini":
            return (
                <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
                    <path d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12z" fill="url(#gemini-gradient)" />
                    <defs>
                        <linearGradient id="gemini-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stopColor="#4285F4" />
                            <stop offset="0.5" stopColor="#9B72CB" />
                            <stop offset="1" stopColor="#D96570" />
                        </linearGradient>
                    </defs>
                </svg>
            );
        case "opencode":
            return (
                <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
                    <circle cx="12" cy="12" r="10" opacity="0.2" />
                    <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor">?</text>
                </svg>
            );
    }
}

// Provider 颜色映射
export const providerColors: Record<string, { bg: string; text: string; border: string }> = {
    anthropic: { bg: "bg-[#D97757]/10", text: "text-[#D97757]", border: "border-[#D97757]/20" },
    openai: { bg: "bg-[#10a37f]/10", text: "text-[#10a37f]", border: "border-[#10a37f]/20" },
    codex: { bg: "bg-[#10a37f]/10", text: "text-[#10a37f]", border: "border-[#10a37f]/20" },
    gemini: { bg: "bg-[#4285F4]/10", text: "text-[#4285F4]", border: "border-[#4285F4]/20" },
    opencode: { bg: "bg-[#6366f1]/10", text: "text-[#6366f1]", border: "border-[#6366f1]/20" },
};

export function getProviderColor(provider: string) {
    return providerColors[provider] || { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
}

// Provider Select 渲染项（带 Logo）
export function ProviderSelectItem({ provider, name }: { provider: string; name: string }) {
    const colors = getProviderColor(provider);
    return (
        <span className={`flex items-center gap-2 ${colors.text}`}>
            <ProviderLogo provider={provider} size={14} />
            {name}
        </span>
    );
}
