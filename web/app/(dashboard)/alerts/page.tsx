"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SeverityBadge,
  StatusBadge,
  TrustScorePill,
} from "@/components/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Alert {
  alertId: string;
  merchantId: string;
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  trustScoreAtAlert: number;
  reasonCodes: string[];
  createdAt: string;
  resolvedAt?: string;
}

export default function AlertsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("OPEN");
  const [severity, setSeverity] = useState<string>("all");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(status !== "all" && { status }),
    ...(severity !== "all" && { severity }),
  });

  const { data, isLoading, mutate } = useSWR(
    `/api/alerts?${queryParams}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const alerts: Alert[] = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const resolveAlert = async (alertId: string) => {
    setIsResolving(true);
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: "POST",
      });
      if (response.ok) {
        mutate();
        globalMutate("/api/dashboard/stats");
        setSelectedAlert(null);
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Alerts</h2>
          <p className="text-muted-foreground">
            Review and manage fraud alerts from the detection system.
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
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={severity}
              onValueChange={(value) => {
                setSeverity(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alert List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : alerts.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert ID</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trust Score</TableHead>
                    <TableHead>Reason Codes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.alertId}>
                      <TableCell className="font-mono text-sm">
                        {alert.alertId.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/merchants/${alert.merchantId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {alert.merchantId.slice(0, 12)}...
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={alert.severity} size="sm" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={alert.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <TrustScorePill score={alert.trustScoreAtAlert} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {alert.reasonCodes.join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          View
                        </Button>
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
              No alerts found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Detail Sheet */}
      <Sheet open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedAlert && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Alert Details
                </SheetTitle>
                <SheetDescription>
                  Alert ID: {selectedAlert.alertId}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center gap-4">
                  <SeverityBadge severity={selectedAlert.severity} />
                  <StatusBadge status={selectedAlert.status} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Merchant ID</span>
                    <Link
                      href={`/merchants/${selectedAlert.merchantId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {selectedAlert.merchantId.slice(0, 16)}...
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trust Score at Alert</span>
                    <TrustScorePill score={selectedAlert.trustScoreAtAlert} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(selectedAlert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedAlert.resolvedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolved</span>
                      <span className="font-medium">
                        {new Date(selectedAlert.resolvedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">Reason Codes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAlert.reasonCodes.map((code, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-muted px-3 py-1 text-sm"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedAlert.status === "OPEN" && (
                  <Button
                    className="w-full"
                    onClick={() => resolveAlert(selectedAlert.alertId)}
                    disabled={isResolving}
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Resolve Alert
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
