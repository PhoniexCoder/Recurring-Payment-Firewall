import { MerchantProfile } from "@/types";
import { MERCHANTS } from "@/lib/constants";

interface Props {
    selectedId: string;
    onSelect: (merchant: MerchantProfile) => void;
}

export default function MerchantSelector({ selectedId, onSelect }: Props) {
    return (
        <div className="mb-10 animate-in fade-in slide-in-from-top-2 duration-500">
            <h2 className="text-lg font-bold text-slate-800 text-center mb-6">Choose a Demo Store</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {MERCHANTS.map((merchant) => {
                    const isSelected = selectedId === merchant.id;

                    // Determine "Store" branding based on ID
                    const storeName = merchant.id.includes("clean") ? "StreamFlow" :
                        merchant.id.includes("dark") ? "GymRat Pro" :
                            merchant.id.includes("post") ? "MyMovies TV" :
                                "GadgetZone";

                    const storeType = merchant.id.includes("clean") ? "Digital Services" :
                        merchant.id.includes("dark") ? "Fitness & Health" :
                            merchant.id.includes("post") ? "Entertainment" :
                                "Electronics";

                    const bgImage = merchant.id.includes("clean") ? "from-blue-500 to-cyan-400" :
                        merchant.id.includes("dark") ? "from-slate-700 to-slate-900" :
                            merchant.id.includes("post") ? "from-purple-600 to-indigo-600" :
                                "from-orange-400 to-red-500";

                    return (
                        <button
                            key={merchant.id}
                            onClick={() => onSelect(merchant)}
                            className={`group relative rounded-2xl overflow-hidden transition-all duration-300 text-left h-48 ${isSelected
                                    ? "ring-4 ring-blue-500/30 shadow-xl scale-[1.02]"
                                    : "hover:shadow-lg hover:-translate-y-1"
                                }`}
                        >
                            {/* Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${bgImage} opacity-90 group-hover:opacity-100 transition-opacity`}></div>

                            {/* Content */}
                            <div className="absolute inset-0 p-6 flex flex-col justify-between text-white">
                                <div>
                                    <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-wider mb-2">
                                        {storeType}
                                    </span>
                                    <h3 className="text-2xl font-extrabold tracking-tight">{storeName}</h3>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-white/80 line-clamp-1 mr-2">{merchant.name}</span>
                                    <div className={`w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center transition-transform ${isSelected ? "scale-110" : "scale-100 group-hover:scale-110"}`}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
