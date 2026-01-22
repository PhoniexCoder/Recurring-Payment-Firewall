import { useState, useEffect } from "react";
import { MerchantProfile, TransactionPayload } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface Props {
    merchant: MerchantProfile;
    onSubmit: (payload: TransactionPayload) => void;
    loading: boolean;
}

export default function CheckoutForm({ merchant, onSubmit, loading }: Props) {
    const [amount, setAmount] = useState<number>(49.99);
    const [currency, setCurrency] = useState<string>("USD");
    const [customerId, setCustomerId] = useState<string>("");
    const [isRecurring, setIsRecurring] = useState<boolean>(true);
    const [wasCustomerCancelled, setWasCustomerCancelled] = useState<boolean>(false);
    const [selectedProduct, setSelectedProduct] = useState<string>("STANDARD"); // STANDARD, TRIAL, CHEAP

    const RATES: Record<string, number> = {
        "USD": 1,
        "INR": 83.50,
        "EUR": 0.92
    };

    useEffect(() => {
        setCustomerId(`CUST-${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`);
    }, []);

    // Update logic based on "Product" selection
    useEffect(() => {
        const rate = RATES[currency];

        if (selectedProduct === "STANDARD") {
            setAmount(parseFloat((49.99 * rate).toFixed(2)));
            setIsRecurring(true);
            setWasCustomerCancelled(false);
        } else if (selectedProduct === "TRIAL") {
            // Simulate "Free Trial" abuse (High value, cancelled user)
            setAmount(parseFloat((99.99 * rate).toFixed(2)));
            setIsRecurring(true);
            setWasCustomerCancelled(true);
        } else if (selectedProduct === "CHEAP") {
            // Simulate "Testing" (Low value)
            setAmount(parseFloat((1.00 * rate).toFixed(2)));
            setIsRecurring(false);
            setWasCustomerCancelled(false);
        }
    }, [selectedProduct, currency]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: TransactionPayload = {
            transactionId: uuidv4(),
            merchantId: merchant.id,
            customerId,
            amount,
            currency,
            timestamp: new Date().toISOString(),
            isRecurring,
            planId: merchant.defaultPlanId,
            status: "SUCCESS",
            wasCustomerCancelled,
        };
        onSubmit(payload);
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col h-full">
            {/* Product Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-100">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Order Summary</h3>
                        <p className="text-sm text-slate-500 mt-1">Completing purchase at {merchant.name}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-slate-900">
                            {currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹"}{amount.toFixed(2)}
                        </span>
                        <p className="text-xs text-slate-400">Total due today</p>
                    </div>
                </div>
            </div>

            <div className="p-8 flex-1 flex flex-col gap-8">

                {/* Fake Product Selection (Controls the Scenario) */}
                <div>
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 block">Select Product Plan</label>
                    <div className="space-y-3">
                        <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedProduct === "STANDARD" ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="product" value="STANDARD" checked={selectedProduct === "STANDARD"} onChange={(e) => setSelectedProduct(e.target.value)} className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500" />
                            <div className="ml-3">
                                <span className="block text-sm font-bold text-slate-900">Premium Subscription</span>
                                <span className="block text-xs text-slate-500">Standard monthly plan</span>
                            </div>
                        </label>

                        <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedProduct === "TRIAL" ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="product" value="TRIAL" checked={selectedProduct === "TRIAL"} onChange={(e) => setSelectedProduct(e.target.value)} className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500" />
                            <div className="ml-3">
                                <span className="block text-sm font-bold text-slate-900">30-Day Free Trial (High Risk)</span>
                                <span className="block text-xs text-slate-500">Simulates "Forgot to Cancel" scenario</span>
                            </div>
                        </label>

                        <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedProduct === "CHEAP" ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="product" value="CHEAP" checked={selectedProduct === "CHEAP"} onChange={(e) => setSelectedProduct(e.target.value)} className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500" />
                            <div className="ml-3">
                                <span className="block text-sm font-bold text-slate-900">Digital Sticker Pack</span>
                                <span className="block text-xs text-slate-500">Low value item (Simulates card testing)</span>
                            </div>
                        </label>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">

                    {/* Visual Credit Card Form */}
                    <div>
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 block">Payment Details</label>
                        <div className="space-y-4">
                            <div>
                                <input type="text" placeholder="Card number" className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-mono text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="MM / YY" className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-sm" />
                                <input type="text" placeholder="CVC" className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Currency Selector (Hidden in plain sight) */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block">Currency</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="INR">INR (₹)</option>
                        </select>
                    </div>

                    <div className="mt-8 border-t border-slate-100 pt-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white transition-all transform active:scale-[0.98] ${loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30"
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </span>
                            ) : (
                                `Pay ${currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹"}${amount.toFixed(2)}`
                            )}
                        </button>
                        <div className="text-center mt-4 flex items-center justify-center text-xs text-slate-400 gap-2">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" /></svg>
                            Secure Payment by FraudFirewall
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
