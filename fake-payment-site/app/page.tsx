"use client";

import { useState } from "react";
import MerchantSelector from "@/components/MerchantSelector";
import CheckoutForm from "@/components/CheckoutForm";
import ResultDisplay from "@/components/ResultDisplay";
import HistoryTable from "@/components/HistoryTable";
import { MerchantProfile, TransactionPayload, FirewallResponse, HistoryItem } from "@/types";
import { callFirewall } from "@/lib/api";

export default function Home() {
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FirewallResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const handleMerchantSelect = (merchant: MerchantProfile) => {
    setSelectedMerchant(merchant);
    setResult(null);
    setError(null);
  };

  const handleTransactionSubmit = async (payload: TransactionPayload) => {
    if (!selectedMerchant) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const historyItem: HistoryItem = {
      timestamp: payload.timestamp,
      transactionId: payload.transactionId,
      merchantName: selectedMerchant.name,
      amount: payload.amount,
      currency: payload.currency,
    };

    try {
      const response = await callFirewall(payload);
      setResult(response);

      setHistory(prev => [{
        ...historyItem,
        decision: response.decision,
        trustScore: response.trustScore
      }, ...prev]);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setResult(null);

      setHistory(prev => [{
        ...historyItem,
        decision: "ERROR"
      }, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">

        {/* Header Section */}
        <header className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4 border border-blue-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Live Demo Environment
          </div>

          <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight sm:text-5xl mb-3">
            Recurring Payment <span className="text-blue-600">Firewall</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Submit simulated transactions to test the behavioral analysis and fraud scoring engine.
          </p>
        </header>

        <MerchantSelector
          selectedId={selectedMerchant?.id || ""}
          onSelect={handleMerchantSelect}
        />

        {selectedMerchant && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-in fade-in zoom-in-95 duration-300">
            {/* Left Column: Input */}
            <div>
              <CheckoutForm
                merchant={selectedMerchant}
                onSubmit={handleTransactionSubmit}
                loading={loading}
              />
            </div>

            {/* Right Column: Output */}
            <div className="flex flex-col gap-8">
              <div className="lg:h-[460px]">
                <ResultDisplay
                  result={result}
                  loading={loading}
                  error={error}
                />
              </div>
            </div>

          </div>
        )}

        {selectedMerchant && <HistoryTable history={history} />}
      </div>
    </main>
  );
}
