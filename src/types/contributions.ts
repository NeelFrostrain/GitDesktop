export interface CommitItem {
  id: string;
  repo_name: string;
  repo_path?: string | null;
  message: string;
  sha: string;
  short_sha: string;
  timestamp: number;
  author_name: string;
  author_email: string;
  relative_date: string;
  branch?: string | null;
}

export interface ContributionDay {
  date: string; // "YYYY-MM-DD"
  count: number;
  level: number; // 0, 1, 2, 3, 4
  weekday: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  is_future: boolean;
  commits: CommitItem[];
}

export interface ContributionWeek {
  first_day: string; // "YYYY-MM-DD"
  month_label?: string | null; // e.g. "Aug", "Sep"
  days: ContributionDay[];
}

export interface ContributionBreakdown {
  commits_count: number;
  prs_count: number;
  reviews_count: number;
  issues_count: number;
  commits_pct: number;
  prs_pct: number;
  reviews_pct: number;
  issues_pct: number;
}

export interface ContributionCalendar {
  total_contributions: number;
  start_date: string;
  end_date: string;
  weeks: ContributionWeek[];
  provider: string; // "all" | "gitlab" | "github" | "bitbucket" | "local"
  account_id?: string | null;
  account_handle: string;
  account_name: string;
  account_avatar: string;
  active_days_count: number;
  longest_streak: number;
  current_streak: number;
  breakdown?: ContributionBreakdown;
}
