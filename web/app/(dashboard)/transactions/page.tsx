"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecisionBadge } from "@/components/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Search, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const Loading = () => null;

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [merchantId, setMerchantId] = useState("");
  const [decision, setDecision] = useState<string>("all");
  const searchParams = useSearchParams();

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(merchantId && { merchantId }),
    ...(decision !== "all" && { decision }),
  });

  const { data, isLoading, mutate } = useSWR(
    `/api/transactions?${queryParams}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const transactions = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h2>
          <p className="text-muted-foreground">
            Real-time view of all processed transactions.
          </p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by Merchant ID..."
                value={merchantId}
                onChange={(e) => {
                  setMerchantId(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={decision}
              onValueChange={(value) => {
                setDecision(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decisions</SelectItem>
                <SelectItem value="ALLOW">Allow</SelectItem>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="BLOCK">Block</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Loading />}>
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : transactions.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Triggered Rules</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx: {
                      transactionId: string;
                      merchantId: string;
                      amount: number;
                      currency: string;
                      status: string;
                      decision: "ALLOW" | "REVIEW" | "BLOCK";
                      latencyMs: number;
                      triggeredRules: string[];
                      timestamp: string;
                    }) => (
                      <TableRow key={tx.transactionId}>
                        <TableCell className="font-mono text-sm">
                          {tx.transactionId.slice(0, 12)}...
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/merchants/${tx.merchantId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {tx.merchantId.slice(0, 12)}...
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.currency} {tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{tx.status}</TableCell>
                        <TableCell>
                          <DecisionBadge decision={tx.decision} size="sm" />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.latencyMs}ms
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {tx.triggeredRules?.length > 0
                            ? tx.triggeredRules.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                No transactions found
              </div>
            )}
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
