import { MerchantProfile } from "@/types";

export const MERCHANTS: MerchantProfile[] = [
    {
        id: "merch_clean_sub_01",
        name: "Clean Subscriptions Pvt Ltd",
        description: "A legitimate software SaaS with transparent pricing.",
        defaultPlanId: "saas_pro_monthly",
    },
    {
        id: "merch_dark_gym_99",
        name: "Dark Trial Gym Co",
        description: "Notorious for hidden fees and impossible cancellation flows.",
        defaultPlanId: "gym_membership_hidden",
    },
    {
        id: "merch_post_cancel_stream",
        name: "Post-Cancel Streaming",
        description: "Streaming service that keeps charging after you leave.",
        defaultPlanId: "stream_4k_family",
    },
    {
        id: "merch_micro_tools",
        name: "MicroCharge Tools",
        description: "Low value tool site often used for card testing.",
        defaultPlanId: "tool_credit_pack",
    },
];
