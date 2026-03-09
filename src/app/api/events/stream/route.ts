// SSE 流式代理路由
// Next.js rewrites 会缓冲响应，不支持 SSE 流式传输
// 此路由使用 ReadableStream 直接向浏览器推送 SSE 事件

const BACKEND_URL = process.env.QUEENBEE_API_URL || "http://localhost:3777";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id") || "";

    let backendUrl = `${BACKEND_URL}/api/events/stream`;
    if (conversationId) {
        backendUrl += `?conversation_id=${encodeURIComponent(conversationId)}`;
    }

    // 使用 AbortController 让客户端断开时也断开后端连接
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

        // 直接将后端的 ReadableStream 透传给浏览器
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

// 禁用 Next.js 默认的响应体缓冲
export const dynamic = "force-dynamic";
