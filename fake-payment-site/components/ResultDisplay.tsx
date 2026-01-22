import { FirewallResponse } from "@/types";
import { useState } from "react";

interface Props {
    result: FirewallResponse | null;
    loading: boolean;
    error: string | null;
}

export default function ResultDisplay({ result, loading, error }: Props) {
    const [showDebug, setShowDebug] = useState(false);

    if (loading) return null; // Logic is handled in the button loading state mostly

    if (error) {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Failed</h2>
                <p className="text-slate-500 max-w-sm mb-6">Something went wrong connecting to the payment gateway.</p>
                <code className="text-xs bg-slate-100 p-2 rounded text-red-500">{error}</code>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center justify-center min-h-[600px] border border-slate-100 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900">Your Cart</h2>
                <p className="text-slate-500 mt-2">Select a product and checkout to begin.</p>
            </div>
        );
    }

    const isAllow = result.decision === "ALLOW";
    const isBlock = result.decision === "BLOCK";

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Main Consumer View */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex-1 flex flex-col items-center justify-center text-center p-12">
                {isAllow ? (
                    <>
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                            <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
                        <p className="text-slate-500 text-lg mb-8">Your order has been confirmed.</p>
                        <div className="w-full max-w-xs bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500">Amount Paid</span>
                                <span className="font-bold text-slate-900">$XX.XX</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Transaction ID</span>
                                <span className="font-mono text-slate-900 text-xs">#{Math.floor(Math.random() * 1000000)}</span>
                            </div>
                        </div>
                        <button onClick={() => window.location.reload()} className="text-blue-600 font-semibold hover:text-blue-700">Return to Store</button>
                    </>
                ) : (
                    <>
                        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                            <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Payment Declined</h2>
                        <p className="text-slate-500 text-lg mb-8 max-w-xs mx-auto">Unfortunately, we could not process your payment at this time.</p>

                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-orange-800 text-sm max-w-sm mb-6">
                            <strong>Why?</strong> Our security systems detected unusual activity with this transaction.
                        </div>

                        <button onClick={() => window.location.reload()} className="text-slate-600 font-semibold hover:text-slate-800">Try a different card</button>
                    </>
                )}
            </div>

            {/* Developer Console (Toggleable) */}
            <div className="relative">
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="w-full flex items-center justify-between p-3 bg-slate-900 text-slate-400 text-xs font-mono rounded-lg hover:text-white transition-colors"
                >
                    <span>[DEVELOPER_CONSOLE] Fraud Analysis Logs</span>
                    <span>{showDebug ? "▼" : "▲"}</span>
                </button>

                {showDebug && (
                    <div className="mt-2 bg-slate-900 rounded-xl p-6 text-left border border-slate-700 font-mono text-xs text-slate-300 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <span className="block text-slate-500">DECISION</span>
                                <span className={`text-lg font-bold ${isAllow ? "text-emerald-400" : "text-red-400"}`}>{result.decision}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500">TRUST SCORE</span>
                                <span className="text-lg font-bold text-blue-400">{result.trustScore}/100</span>
                            </div>
                            <div>
                                <span className="block text-slate-500">RISK LEVEL</span>
                                <span className="text-white">{result.riskLevel}</span>
                            </div>
                            <div>
                                <span className="block text-slate-500">LATENCY</span>
                                <span className="text-white">{result.latencyMs}ms</span>
                            </div>
                        </div>
                        <div>
                            <span className="block text-slate-500 mb-1">TRIGGERED RULES</span>
                            {result.triggeredRules.length > 0 ? (
                                <ul className="space-y-1">
                                    {result.triggeredRules.map((r, i) => (
                                        <li key={i} className="text-red-300">- {r}</li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="text-slate-600 italic">None</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
