// Agent 活跃度 SSE 流式代理路由
// 与 events/stream 相同原理：绕过 Next.js rewrites 的响应缓冲

const BACKEND_URL = process.env.QUEENBEE_API_URL || "http://localhost:3777";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agent_id") || "";

    let backendUrl = `${BACKEND_URL}/api/activity/stream`;
    if (agentId) {
        backendUrl += `?agent_id=${encodeURIComponent(agentId)}`;
    }

    const controller = new AbortController();
    request.signal.addEventListener("abort", () => controller.abort());

    try {
        const backendRes = await fetch(backendUrl, {
            signal: controller.signal,
            headers: { Accept: "text/event-stream" },
        });

        if (!backendRes.ok || !backendRes.body) {
            return new Response("后端 SSE 连接失败", { status: 502 });
        }

        return new Response(backendRes.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            return new Response(null, { status: 499 });
        }
        return new Response("SSE 代理错误", { status: 502 });
    }
}

export const dynamic = "force-dynamic";
