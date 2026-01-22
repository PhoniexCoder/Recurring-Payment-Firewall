"use client";

import useSWR from "swr";
import { KPICard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge, TrustScorePill } from "@/components/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Building2,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useSWR(
    "/api/dashboard/stats",
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: alertsData, isLoading: alertsLoading } = useSWR(
    "/api/alerts?status=OPEN&limit=5",
    fetcher,
    { refreshInterval: 30000 }
  );

  // Prepare data for charts
  const decisionData = stats?.transactions
    ? [
        { name: "Allow", value: stats.transactions.allow, fill: "var(--color-success)" },
        { name: "Review", value: stats.transactions.review, fill: "var(--color-warning)" },
        { name: "Block", value: stats.transactions.block, fill: "var(--color-danger)" },
      ]
    : [];

  const riskData = stats?.riskDistribution
    ? [
        { name: "Low Risk", value: stats.riskDistribution.LOW, fill: "var(--color-success)" },
        { name: "Medium Risk", value: stats.riskDistribution.MEDIUM, fill: "var(--color-warning)" },
        { name: "High Risk", value: stats.riskDistribution.HIGH, fill: "var(--color-danger)" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your payment firewall metrics and alerts.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <KPICard
              title="Total Transactions Today"
              value={stats?.transactions?.total || 0}
              icon={CreditCard}
              variant="default"
            />
            <KPICard
              title="Allowed"
              value={stats?.transactions?.allow || 0}
              subtitle={`${stats?.transactions?.total > 0 ? ((stats.transactions.allow / stats.transactions.total) * 100).toFixed(1) : 0}% of total`}
              icon={CheckCircle}
              variant="success"
            />
            <KPICard
              title="Open Alerts"
              value={stats?.openAlerts || 0}
              icon={AlertTriangle}
              variant="warning"
            />
            <KPICard
              title="Total Merchants"
              value={stats?.totalMerchants || 0}
              icon={Building2}
              variant="default"
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Decision Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Decision Distribution (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={decisionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-muted-foreground" />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Merchant Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Alerts</CardTitle>
          <Link
            href="/alerts"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : alertsData?.data?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant ID</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Trust Score</TableHead>
                  <TableHead>Reason Codes</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertsData.data.map((alert: {
                  alertId: string;
                  merchantId: string;
                  severity: "MEDIUM" | "HIGH" | "CRITICAL";
                  trustScoreAtAlert: number;
                  reasonCodes: string[];
                  createdAt: string;
                }) => (
                  <TableRow key={alert.alertId}>
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
                      <TrustScorePill score={alert.trustScoreAtAlert} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {alert.reasonCodes.join(", ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No open alerts
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
