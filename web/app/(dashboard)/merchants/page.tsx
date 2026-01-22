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
import { RiskBadge, TrustScorePill } from "@/components/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Loading from "./loading";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MerchantsPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState<string>("all");

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "15",
    ...(search && { search }),
    ...(riskLevel !== "all" && { riskLevel }),
  });

  const { data, isLoading } = useSWR(
    `/api/merchants?${queryParams}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const merchants = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Merchants</h2>
        <p className="text-muted-foreground">
          View and manage all merchants in the payment firewall system.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by merchant ID or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={riskLevel}
              onValueChange={(value) => {
                setRiskLevel(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="LOW">Low Risk</SelectItem>
                <SelectItem value="MEDIUM">Medium Risk</SelectItem>
                <SelectItem value="HIGH">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Merchants</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : merchants.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Trust Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Last Evaluated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchants.map((merchant: {
                    merchantId: string;
                    name: string;
                    category: string;
                    country: string;
                    currentTrustScore: number;
                    riskLevel: "LOW" | "MEDIUM" | "HIGH";
                    lastEvaluatedAt: string;
                  }) => (
                    <TableRow key={merchant.merchantId} className="cursor-pointer">
                      <TableCell>
                        <Link
                          href={`/merchants/${merchant.merchantId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {merchant.merchantId.slice(0, 16)}...
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{merchant.name}</TableCell>
                      <TableCell className="text-muted-foreground">{merchant.category}</TableCell>
                      <TableCell className="text-muted-foreground">{merchant.country}</TableCell>
                      <TableCell>
                        <TrustScorePill score={merchant.currentTrustScore} />
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={merchant.riskLevel} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(merchant.lastEvaluatedAt).toLocaleString()}
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
              No merchants found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
