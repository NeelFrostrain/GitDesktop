import { invoke } from '@tauri-apps/api/core';
import { ContributionCalendar } from '../../types/contributions';

export class ContributionsService {
  /**
   * Fetch aggregated or account-specific contribution calendar
   */
  static async getContributionsCalendar(
    accountId?: string | null,
    repoPaths: string[] = []
  ): Promise<ContributionCalendar> {
    return await invoke<ContributionCalendar>('get_contributions_calendar_cmd', {
      accountId: accountId || null,
      repoPaths,
    });
  }
}
