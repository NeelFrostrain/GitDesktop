import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
import { useAccountServicesStore } from "./store/accountStore";
import { AccountsTab } from "./tabs/AccountsTab";
import { AddAccountTab } from "./tabs/AddAccountTab";

/**
 * Clean, modern modal dialog for managing multiple Git provider accounts
 * and configuring 1-click browser OAuth sign-ins.
 */
export const AccountServicesModal: React.FC = () => {
  const { isModalOpen, setIsModalOpen, activeTab, accounts, loadAccounts } =
    useAccountServicesStore();

  useEffect(() => {
    if (isModalOpen) {
      loadAccounts();
    }
  }, [isModalOpen, loadAccounts]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, setIsModalOpen]);

  if (!isModalOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-services-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsModalOpen(false);
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-150 font-sans"
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-base-1 border border-border rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Clean Modal Header */}
        <div className="px-4 py-3 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div> */}
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id="account-services-modal-title"
                className="text-xs font-bold text-text-primary leading-none"
              >
                Connected Accounts
              </h2>
              {accounts.length > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-xs bg-base-2 border border-border text-text-muted">
                  {accounts.length}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-base-0">
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "add" && <AddAccountTab />}
        </div>
      </div>
    </div>,
    document.body,
  );
};
