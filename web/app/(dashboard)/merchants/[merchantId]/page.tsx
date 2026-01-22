"use client";

import { useState, use } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RiskBadge,
  TrustScorePill,
  DecisionBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Loader2,
  CheckCircle,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MerchantDetailPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const { merchantId } = use(params);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolving, setIsResolving] = useState<string | null>(null);

  const { data: merchant, isLoading, error } = useSWR(
    `/api/merchants/${merchantId}`,
    fetcher
  );

  const generateExplanation = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/explanations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId }),
      });
      if (response.ok) {
        mutate(`/api/merchants/${merchantId}`);
      }
    } catch (error) {
      console.error("Failed to generate explanation:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    setIsResolving(alertId);
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: "POST",
      });
      if (response.ok) {
        mutate(`/api/merchants/${merchantId}`);
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    } finally {
      setIsResolving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="space-y-6">
        <Link
          href="/merchants"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Merchants
        </Link>
        <Card>
          <CardContent className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">Merchant not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const features = merchant.features || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/merchants"
            className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Merchants
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{merchant.name}</h2>
          <p className="text-muted-foreground">{merchant.merchantId}</p>
        </div>
        <div className="flex items-center gap-4">
          <TrustScorePill score={merchant.currentTrustScore} />
          <RiskBadge level={merchant.riskLevel} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="explanation">Explanation</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Merchant Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Merchant Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{merchant.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <span className="font-medium">{merchant.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Onboarded</span>
                  <span className="font-medium">
                    {new Date(merchant.onboardedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Evaluated</span>
                  <span className="font-medium">
                    {new Date(merchant.lastEvaluatedAt).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
                <CardDescription>Last 30-day window</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Chargeback Rate</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {((features.chargebackRate || 0) * 100).toFixed(2)}%
                    </span>
                    {(features.chargebackRate || 0) > 0.01 && (
                      <TrendingUp className="h-4 w-4 text-danger" />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Refund Rate</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {((features.refundRate || 0) * 100).toFixed(2)}%
                    </span>
                    {(features.refundRate || 0) > 0.15 && (
                      <TrendingUp className="h-4 w-4 text-warning" />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Post-Cancel Charges</span>
                  <span className="font-medium">{features.postCancelChargeCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">First Cycle Cancel Rate</span>
                  <span className="font-medium">
                    {((features.firstCycleCancelRate || 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Micro-Charge Ratio</span>
                  <span className="font-medium">
                    {((features.microChargeRatio || 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Anomaly Score</span>
                  <span className="font-medium">
                    {((features.anomalyScore || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <span className="text-muted-foreground">Total Transactions</span>
                  <span className="text-2xl font-bold">{features.txCount || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <span className="text-muted-foreground">Recurring Transactions</span>
                  <span className="text-2xl font-bold">{features.recurringTxCount || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {merchant.recentTransactions?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merchant.recentTransactions.map((tx: {
                      transactionId: string;
                      amount: number;
                      currency: string;
                      status: string;
                      decision: "ALLOW" | "REVIEW" | "BLOCK";
                      latencyMs: number;
                      timestamp: string;
                    }) => (
                      <TableRow key={tx.transactionId}>
                        <TableCell className="font-mono text-sm">
                          {tx.transactionId.slice(0, 16)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.currency} {tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{tx.status}</TableCell>
                        <TableCell>
                          <DecisionBadge decision={tx.decision} size="sm" />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.latencyMs}ms
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No transactions found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Open Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {merchant.openAlerts?.length > 0 ? (
                <div className="space-y-4">
                  {merchant.openAlerts.map((alert: {
                    alertId: string;
                    severity: "MEDIUM" | "HIGH" | "CRITICAL";
                    status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
                    trustScoreAtAlert: number;
                    reasonCodes: string[];
                    createdAt: string;
                  }) => (
                    <div
                      key={alert.alertId}
                      className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-start gap-4">
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
                        <div>
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={alert.severity} size="sm" />
                            <StatusBadge status={alert.status} size="sm" />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Trust Score: {alert.trustScoreAtAlert} | Created:{" "}
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                          <p className="mt-1 text-sm">
                            Reason Codes: {alert.reasonCodes.join(", ")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlert(alert.alertId)}
                        disabled={isResolving === alert.alertId}
                      >
                        {isResolving === alert.alertId ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Resolving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Resolve
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No open alerts
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Explanation Tab */}
        <TabsContent value="explanation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>AI-Generated Explanation</CardTitle>
                <CardDescription>
                  RAG-powered analysis of merchant behavior patterns
                </CardDescription>
              </div>
              <Button
                onClick={generateExplanation}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {merchant.latestExplanation ? "Refresh" : "Generate"} Explanation
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {merchant.latestExplanation ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="mb-2 font-semibold">Analysis</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {merchant.latestExplanation.explanationText}
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Recommended Actions</h4>
                    <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                      {merchant.latestExplanation.recommendedActions.map(
                        (action: string, index: number) => (
                          <li key={index}>{action}</li>
                        )
                      )}
                    </ul>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Source: {merchant.latestExplanation.sourceType}
                    </span>
                    <span>
                      Generated: {new Date(merchant.latestExplanation.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  No explanation generated yet. Click the button above to generate one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
