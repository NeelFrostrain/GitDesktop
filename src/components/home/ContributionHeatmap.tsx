import React, { useEffect, useState, useRef } from 'react';
import {
  RefreshCw,
  ChevronDown,
  Layers,
  Check,
  Flame,
  FolderGit2,
  Calendar as CalendarIcon,
  Zap,
} from 'lucide-react';
import { useContributionsStore } from '../../store/contributionsStore';
import { useAccountServicesStore } from '../../features/account-services';
import { ContributionCommitList } from './ContributionCommitList';
import { UserAvatar } from '../common/UserAvatar';

// Authentic contribution colors with Level 0 harmonized to bg-base-1
const LEVEL_CLASSES = [
  'bg-base-2/50 border-border hover:border-border-strong', // 0 (empty)
  'bg-[#0e4429] border-[#0e4429] hover:border-[#146c3e]', // 1 (1-2)
  'bg-[#006d32] border-[#006d32] hover:border-[#008f42]', // 2 (3-5)
  'bg-[#26a641] border-[#26a641] hover:border-[#38c858]', // 3 (6-9)
  'bg-[#39d353] border-[#39d353] hover:brightness-110 shadow-xs shadow-[#39d353]/30', // 4 (10+)
];

export const ContributionHeatmap: React.FC = () => {
  const calendar = useContributionsStore((s) => s.calendar);
  const selectedAccountId = useContributionsStore((s) => s.selectedAccountId);
  const selectedDate = useContributionsStore((s) => s.selectedDate);
  const isLoading = useContributionsStore((s) => s.isLoading);
  const setSelectedAccountId = useContributionsStore((s) => s.setSelectedAccountId);
  const setSelectedDate = useContributionsStore((s) => s.setSelectedDate);
  const loadContributions = useContributionsStore((s) => s.loadContributions);
  const refresh = useContributionsStore((s) => s.refresh);

  const accounts = useAccountServicesStore((s) => s.accounts);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContributions();
  }, [loadContributions, accounts.length]);

  // Auto-scroll to the current week (far right) on mount & calendar change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [calendar]);

  // Dismiss dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTooltipDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();

      let suffix = 'th';
      if (day === 1 || day === 21 || day === 31) suffix = 'st';
      else if (day === 2 || day === 22) suffix = 'nd';
      else if (day === 3 || day === 23) suffix = 'rd';

      return `${monthName} ${day}${suffix}, ${year}`;
    } catch {
      return dateStr;
    }
  };

  const getActiveAccountLabel = () => {
    if (selectedAccountId === 'all') return 'All Accounts (Merged)';
    if (selectedAccountId === 'local') return 'Local Git Repos';
    const found = accounts.find((a) => a.id === selectedAccountId);
    if (found) return found.display_name || found.handle;
    return calendar?.account_handle || 'All Accounts';
  };

  const getActiveAccountProvider = () => {
    if (selectedAccountId === 'all') return 'all';
    if (selectedAccountId === 'local') return 'local';
    const found = accounts.find((a) => a.id === selectedAccountId);
    return found?.provider || 'gitlab';
  };

  return (
    <div className="p-3.5 sm:p-4 bg-base-1/50 border border-border rounded-sm shadow-2xs space-y-3.5 select-none font-sans relative">
      {/* ── 1. Top Section Header with KPIs & Account Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
        {/* Left: Title & Quick Metrics */}
        <div className="flex items-center gap-3">
          {/* <div className="w-7.5 h-7.5 rounded-sm bg-commito-coral/10 border border-commito-coral/25 flex items-center justify-center text-commito-coral shrink-0 shadow-2xs">
            <Activity className="w-3.5 h-3.5" />
          </div> */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-semibold text-text-primary tracking-tight">
                Contribution Activity
              </h2>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-xs bg-base-1 border border-border text-commito-coral">
                {calendar
                  ? `${calendar.total_contributions.toLocaleString()} contributions`
                  : '0 contributions'}
              </span>
              {isLoading && <RefreshCw className="w-3 h-3 text-commito-coral animate-spin" />}
            </div>

            {/* Sub-KPIs (Streaks & Active Days) */}
            <div className="flex items-center gap-2.5 text-[11px] text-text-muted mt-0.5">
              <span>Past 12 months</span>
              {calendar && calendar.current_streak > 0 && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <Flame className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                    Current: {calendar.current_streak}d
                  </span>
                </>
              )}
              {calendar && calendar.longest_streak > 0 && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-text-secondary font-medium">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Best: {calendar.longest_streak}d
                  </span>
                </>
              )}
              {calendar && calendar.active_days_count > 0 && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <CalendarIcon className="w-3 h-3" />
                    {calendar.active_days_count} active days
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Account Dropdown & Refresh */}
        <div className="flex items-center gap-1.5">
          {/* Account Filter Dropdown */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((v) => !v)}
              className={`h-7.5 px-2.5 rounded-sm border transition-all duration-150 flex items-center gap-2 cursor-pointer select-none shadow-2xs text-xs font-medium ${
                isAccountMenuOpen
                  ? 'bg-base-2 border-border-strong text-text-primary'
                  : 'bg-base-1 hover:bg-base-2 active:bg-base-2/80 border border-border hover:border-border-strong text-text-primary'
              }`}
            >
              <span className="truncate max-w-[150px]">{getActiveAccountLabel()}</span>
              <ChevronDown
                className={`w-3 h-3 text-text-muted transition-transform duration-150 ml-0.5 shrink-0 ${
                  isAccountMenuOpen ? 'rotate-180 text-commito-coral' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isAccountMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-base-1 border border-border rounded-sm shadow-2xl z-50 py-1 text-xs select-none font-sans text-text-primary animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/40">
                <div className="p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId('all');
                      setIsAccountMenuOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xs text-xs flex items-center justify-between transition cursor-pointer ${
                      selectedAccountId === 'all'
                        ? 'bg-base-2 text-text-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-base-2'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>All Accounts (Merged)</span>
                    </div>
                    {selectedAccountId === 'all' && (
                      <Check className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountId('local');
                      setIsAccountMenuOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xs text-xs flex items-center justify-between transition cursor-pointer ${
                      selectedAccountId === 'local'
                        ? 'bg-base-2 text-text-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-base-2'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>Local Git Repos Only</span>
                    </div>
                    {selectedAccountId === 'local' && (
                      <Check className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                    )}
                  </button>
                </div>

                {accounts.length > 0 && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <div className="p-1 max-h-48 overflow-y-auto space-y-0.5">
                      <p className="px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted">
                        Linked Provider Accounts
                      </p>
                      {accounts.map((acc) => {
                        const isSelected = selectedAccountId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setSelectedAccountId(acc.id);
                              setIsAccountMenuOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xs text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-base-2 text-text-primary font-semibold'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-2'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                url={acc.avatar_url}
                                name={acc.display_name || acc.handle}
                                className="w-4 h-4 rounded-sm border border-border shrink-0"
                              />
                              <div className="truncate text-left">
                                <p className="truncate font-medium text-xs">
                                  {acc.display_name || acc.handle}
                                </p>
                                <p className="text-[10px] text-text-muted uppercase font-mono">
                                  {acc.provider}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-commito-coral shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quick Refresh Button */}
          <button
            type="button"
            onClick={() => refresh()}
            className="h-7.5 w-7.5 bg-base-1 hover:bg-base-2 border border-border text-text-muted hover:text-text-primary rounded-sm flex items-center justify-center transition cursor-pointer shadow-2xs"
            title="Refresh commit and contribution data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-commito-coral' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* ── 2. Heatmap Calendar (Full width within card) ── */}
      <div className="p-3 sm:p-3.5 bg-surface-subtle/80 border border-border/70 rounded-sm flex flex-col justify-between relative overflow-hidden">
        {/* Scrollable Grid Canvas */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-2 focus:outline-none"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          }}
        >
          <div className="min-w-fit flex gap-2.5">
            {/* Left Column: Weekday labels aligned with 7 day rows */}
            <div className="flex flex-col gap-[3px] pt-[20px] text-[9.5px] text-text-muted font-medium select-none pr-1 shrink-0">
              <span className="h-[10.5px] leading-[10.5px] opacity-0 select-none">Sun</span>
              <span className="h-[10.5px] leading-[10.5px]">Mon</span>
              <span className="h-[10.5px] leading-[10.5px] opacity-0 select-none">Tue</span>
              <span className="h-[10.5px] leading-[10.5px]">Wed</span>
              <span className="h-[10.5px] leading-[10.5px] opacity-0 select-none">Thu</span>
              <span className="h-[10.5px] leading-[10.5px]">Fri</span>
              <span className="h-[10.5px] leading-[10.5px] opacity-0 select-none">Sat</span>
            </div>

            {/* Matrix Columns */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {/* Month Labels Row on Top */}
              <div className="flex gap-[3px] text-[10px] text-text-muted font-medium h-[15px] relative select-none">
                {calendar?.weeks.map((week, wIdx) => (
                  <div
                    key={week.first_day || wIdx}
                    className="w-[10.5px] shrink-0 text-left relative"
                  >
                    {week.month_label && (
                      <span className="absolute top-0 left-0 text-[10px] text-text-muted font-normal whitespace-nowrap leading-none">
                        {week.month_label}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Heatmap Columns with Small Crisp Squares */}
              <div className="flex gap-[3px]">
                {calendar?.weeks.map((week, wIdx) => (
                  <div key={week.first_day || wIdx} className="flex flex-col gap-[3px] shrink-0">
                    {week.days.map((day) => {
                      const isSelected = selectedDate === day.date;
                      const levelClass = day.is_future
                        ? 'bg-base-0/30 border-transparent opacity-20 cursor-not-allowed'
                        : LEVEL_CLASSES[day.level] || LEVEL_CLASSES[0];

                      return (
                        <div
                          key={day.date}
                          onClick={() => {
                            if (!day.is_future) {
                              setSelectedDate(isSelected ? null : day.date);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (!day.is_future) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredDay({
                                date: day.date,
                                count: day.count,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`w-[10.5px] h-[10.5px] rounded-2xs border transition-all duration-75 cursor-pointer ${levelClass} ${
                            isSelected
                              ? 'ring-2 ring-commito-coral ring-offset-1 ring-offset-surface scale-125 z-10'
                              : 'hover:ring-1 hover:ring-text-primary/70 hover:scale-110'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap Footer Bar: Active Account & Scale */}
        <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-3 text-[11px] text-text-muted font-sans">
          <div className="flex items-center gap-2">
            {/* {getActiveAccountProvider() === 'all' ? (
              // <Layers className="w-3.5 h-3.5 text-commito-coral shrink-0" />
              ""
            ) : getActiveAccountProvider() === 'local' ? (
              // <FolderGit2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
            ) : (
              <span
                className={`text-[8.5px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border shrink-0 ${
                  getActiveAccountProvider() === 'github'
                    ? 'text-purple-400 bg-purple-950/40 border-purple-800/40'
                    : getActiveAccountProvider() === 'bitbucket'
                      ? 'text-blue-400 bg-blue-950/40 border-blue-800/40'
                      : 'text-commito-coral bg-commito-coral/10 border-commito-coral/30'
                }`}
              >
                {getActiveAccountProvider()}
              </span>
            )} */}
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="hover:text-text-primary hover:underline transition cursor-pointer text-[10.5px] truncate"
            >
              Showing {getActiveAccountLabel()} commit activity
            </button>
          </div>

          {/* Color Scale Legend: Less -> More */}
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span>Less</span>
            <div className="flex gap-[3px] items-center">
              {LEVEL_CLASSES.map((colorClass, idx) => (
                <div
                  key={idx}
                  className={`w-[10px] h-[10px] rounded-2xs border ${colorClass}`}
                  title={`Level ${idx}`}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </div>

      {/* ── 3. Bottom Section: Commit Activity Inspector ── */}
      <ContributionCommitList />

      {/* ── Floating Tooltip ── */}
      {hoveredDay && (
        <div
          className="fixed pointer-events-none z-50 px-2.5 py-1 bg-surface-elevated text-text-primary text-[11px] font-medium rounded-sm shadow-2xl border border-border-strong transform -translate-x-1/2 -translate-y-full mb-1.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-75 font-sans"
          style={{
            left: hoveredDay.x,
            top: hoveredDay.y - 6,
          }}
        >
          {hoveredDay.count > 0 ? (
            <span>
              <strong className="text-commito-coral font-semibold">{hoveredDay.count}</strong>{' '}
              {hoveredDay.count === 1 ? 'contribution' : 'contributions'} on{' '}
              {formatTooltipDate(hoveredDay.date)}
            </span>
          ) : (
            <span>No contributions on {formatTooltipDate(hoveredDay.date)}</span>
          )}
          {/* Tooltip caret */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-surface-elevated" />
        </div>
      )}
    </div>
  );
};
