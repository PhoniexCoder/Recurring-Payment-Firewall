import { FirewallResponse, TransactionPayload } from "@/types";

export async function callFirewall(payload: TransactionPayload): Promise<FirewallResponse> {
    const FIREWALL_URL = process.env.NEXT_PUBLIC_FIREWALL_URL;

    if (!FIREWALL_URL) {
        throw new Error("NEXT_PUBLIC_FIREWALL_URL is not set");
    }

    // The env var is expected to be the base URL (e.g. http://localhost:3000)
    const endpoint = `${FIREWALL_URL}/api/transactions/evaluate`;

    const startTime = performance.now();

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const endTime = performance.now();
        const latencyForFetch = Math.round(endTime - startTime);

        if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error");
            throw new Error(`Firewall returned ${res.status}: ${errorText}`);
        }

        const data = await res.json();

        // Supplement latency if not provided by backend
        return {
            ...data,
            latencyMs: data.latencyMs || latencyForFetch,
        };
    } catch (error) {
        console.error("Firewall API connection error:", error);
        throw error;
    }
}
