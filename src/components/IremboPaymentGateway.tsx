import React, { useState, useEffect, useCallback, memo } from "react";
import { LandApplication, LandParcel } from "../types";
import {
  Smartphone, Building2, CheckCircle2, Loader2, X, ArrowRight, Receipt
} from "lucide-react";

type PaymentStep = "method" | "pin" | "processing" | "receipt";

interface IremboPaymentGatewayProps {
  app: LandApplication | null;
  parcel: LandParcel | null;
  citizenName: string;
  citizenPhone: string;
  onConfirm: (receipt: string) => void;
  onCancel: () => void;
}

const SERVICE_FEE = 50000;

const PAYMENT_METHODS = [
  { id: "mtn", label: "MTN Mobile Money", icon: Smartphone, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { id: "airtel", label: "Airtel Money", icon: Smartphone, color: "text-red-600 bg-red-50 border-red-200" },
  { id: "bank", label: "Bank Transfer", icon: Building2, color: "text-blue-600 bg-blue-50 border-blue-200" },
] as const;

const IremboPaymentGateway = memo(function IremboPaymentGateway({
  app,
  parcel,
  citizenName,
  citizenPhone,
  onConfirm,
  onCancel,
}: IremboPaymentGatewayProps) {
  const [step, setStep] = useState<PaymentStep>("method");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const [receipt, setReceipt] = useState("");
  const pinInputRefs = pin.map(() => React.createRef<HTMLInputElement>());

  const isAppPayment = !!app;
  const amount = isAppPayment ? SERVICE_FEE : (parcel?.annualTax || 0);

  const handleSelectMethod = (methodId: string) => {
    setSelectedMethod(methodId);
    if (methodId === "bank") {
      simulateProcessing();
    } else {
      setStep("pin");
    }
  };

  const handlePinChange = (idx: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newPin = [...pin];
    newPin[idx] = value;
    setPin(newPin);
    setPinError("");

    if (value && idx < 3) {
      pinInputRefs[idx + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      pinInputRefs[idx - 1].current?.focus();
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = pin.join("");
    if (fullPin.length !== 4) {
      setPinError("PIN must be 4 digits");
      return;
    }
    simulateProcessing();
  };

  const simulateProcessing = useCallback(() => {
    setStep("processing");
    setProgressMsg("Connecting to payment gateway...");

    const steps = [
      { delay: 800, msg: "Verifying merchant credentials..." },
      { delay: 1600, msg: "Processing transaction with Rwanda Clearing House..." },
      { delay: 2400, msg: "Receiving confirmation from mobile operator..." },
      { delay: 3200, msg: "Generating official Irembo receipt..." },
    ];

    steps.forEach(({ delay, msg }) => {
      setTimeout(() => setProgressMsg(msg), delay);
    });

    setTimeout(() => {
      const receiptNo = `IREMBO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}-RWA`;
      setReceipt(receiptNo);
      setStep("receipt");
    }, 4000);
  }, []);

  const handleDone = () => {
    if (receipt) onConfirm(receipt);
  };

  useEffect(() => {
    if (step === "receipt") {
      const timer = setTimeout(() => {
        const el = document.getElementById("irembo_receipt_actions");
        el?.classList.remove("opacity-0", "translate-y-2");
        el?.classList.add("opacity-100", "translate-y-0");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-[10px]">R</div>
            <div>
              <h3 className="text-white font-bold text-[11px] leading-tight">Irembo Gov Payment</h3>
              <p className="text-[8px] text-slate-400 font-mono">Rwanda e-Government Gateway</p>
            </div>
          </div>
          {step !== "processing" && (
            <button onClick={onCancel} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-1 px-4 py-2 bg-slate-50 border-b border-slate-200">
          {(["method", "pin", "processing", "receipt"] as const).map((s, i) => {
            const stepOrder = ["method", "pin", "processing", "receipt"];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(s);
            const isActive = thisIdx <= currentIdx;
            const isCurrent = s === step;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 ${isCurrent ? "text-emerald-600" : isActive ? "text-emerald-500" : "text-slate-300"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${
                    isActive ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider ${isCurrent ? "" : "hidden sm:inline"}`}>
                    {s === "method" ? "Method" : s === "pin" ? "PIN" : s === "processing" ? "Process" : "Receipt"}
                  </span>
                </div>
                {i < 3 && <div className={`h-px w-6 ${isActive ? "bg-emerald-400" : "bg-slate-200"}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1: Payment Method Selection */}
          {step === "method" && (
            <>
              {/* Payment Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Service</span>
                  <span className="font-semibold text-slate-700">
                    {isAppPayment ? `${app!.type} Application Fee` : "Property Tax Clearance"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payer</span>
                  <span className="text-slate-700">{citizenName}</span>
                </div>
                {app?.upi && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">UPI</span>
                    <span className="font-mono text-slate-700">{app.upi}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-800">
                  <span>Amount</span>
                  <span className="text-emerald-700 font-mono">{amount.toLocaleString()} RWF</span>
                </div>
              </div>

              {/* Method Selection */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Select payment method</p>
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => handleSelectMethod(method.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition cursor-pointer ${
                        selectedMethod === method.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className={`p-2 rounded-lg border ${method.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-[11px] text-slate-800">{method.label}</p>
                        <p className="text-[8.5px] text-slate-400">
                          {method.id === "bank" ? "1-3 business days" : "Instant processing"}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={onCancel}
                className="w-full py-1.5 text-[10px] text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
              >
                Cancel Payment
              </button>
            </>
          )}

          {/* Step 2: PIN Entry (Mobile Money) */}
          {step === "pin" && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                  <Smartphone className="w-6 h-6" />
                </div>
                <p className="font-bold text-xs text-slate-800">
                  {selectedMethod === "mtn" ? "MTN Mobile Money" : "Airtel Money"} PIN
                </p>
                <p className="text-[9px] text-slate-500">
                  Enter your 4-digit PIN to authorize payment of <strong className="text-emerald-700">{amount.toLocaleString()} RWF</strong>
                </p>
                <p className="text-[8.5px] font-mono text-slate-400">
                  {citizenPhone}
                </p>
              </div>

              <div className="flex justify-center gap-2.5">
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={pinInputRefs[idx]}
                    type="password"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    className="w-10 h-12 text-center text-lg font-black border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500 bg-white text-slate-800"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
              {pinError && (
                <p className="text-[9.5px] text-rose-500 text-center font-bold">{pinError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStep("method"); setPin(["", "", "", ""]); }}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded text-[10px] border border-slate-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={pin.join("").length !== 4}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded text-[10px] cursor-pointer"
                >
                  Authorize Payment
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Processing */}
          {step === "processing" && (
            <div className="text-center space-y-4 py-6">
              <div className="relative">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 animate-ping opacity-60" />
                </div>
              </div>
              <div>
                <p className="font-bold text-xs text-slate-800">Processing Payment</p>
                <p className="text-[9px] text-slate-500 mt-1 animate-pulse">{progressMsg}</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden max-w-[200px] mx-auto">
                <div className="bg-emerald-500 h-full rounded-full animate-[progress_4s_ease-in-out]" style={{ width: "100%" }} />
              </div>
            </div>
          )}

          {/* Step 4: Receipt */}
          {step === "receipt" && (
            <div className="space-y-3.5">
              <div className="text-center space-y-1">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="font-bold text-xs text-slate-800">Payment Successful!</p>
                <p className="text-[9px] text-slate-500">{amount.toLocaleString()} RWF charged successfully</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5 text-[9.5px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <Receipt className="w-3.5 h-3.5" />
                  Official Irembo Receipt
                </div>
                <div className="border-t border-emerald-200 pt-1.5 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Transaction ID</span>
                    <span className="font-mono font-bold text-slate-800">{receipt}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Service</span>
                    <span>{isAppPayment ? `${app!.type} Application` : "Property Tax"}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payer</span>
                    <span>{citizenName}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Amount</span>
                    <span className="font-mono font-bold text-emerald-700">{amount.toLocaleString()} RWF</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Method</span>
                    <span className="font-bold uppercase text-[8px]">
                      {selectedMethod === "mtn" ? "MTN MoMo" : selectedMethod === "airtel" ? "Airtel Money" : "Bank Transfer"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Date</span>
                    <span className="font-mono">{new Date().toLocaleDateString("en-GB")}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Status</span>
                    <span className="text-emerald-600 font-bold">COMPLETED</span>
                  </div>
                </div>
              </div>

              <div id="irembo_receipt_actions" className="flex gap-2 opacity-0 translate-y-2 transition-all duration-300">
                <button
                  onClick={handleDone}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] cursor-pointer"
                >
                  {isAppPayment ? "Complete & Submit" : "Confirm Tax Payment"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default IremboPaymentGateway;
