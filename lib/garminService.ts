import GarminConnect from 'garmin-connect';

/**
 * Garmin Connect API Service using garmin-connect npm library
 */

export interface Activity {
  id: string;
  startTime: string;
  type: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  calories: number;
}

export interface WellnessData {
  restingHeartRate: number | null;
  sleep: {
    duration: number;
    stages: {
      deep: number;
      light: number;
      rem: number;
      awake: number;
    };
  } | null;
  hrvStatus: string | null;
  bodyBattery: {
    value: number;
  } | null;
}

class GarminService {
  private client: any = null;

  isAuthenticated(): boolean {
    return !!this.client;
  }

  async login(email: string, password: string): Promise&lt;void&gt; {
    this.client = new GarminConnect({
      username: email,
      password,
    });
    await this.client.login();
  }

  async clearTokens(): Promise&lt;void&gt; {
    this.client = null;
  }

  private async ensureAuthenticated(): Promise&lt;void&gt; {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Call login first.');
    }
  }

  async getActivities(days: number = 30): Promise&lt;Activity[]&gt; {
    await this.ensureAuthenticated();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString().split('T')[0];

    let start = 0;
    const limit = 100;
    const allActivities: any[] = [];

    do {
      const batch: any[] = await this.client.getActivities(start, limit);
      if (!batch || batch.length === 0) break;
      allActivities.push(...batch);
      start += limit;
    } while (allActivities.length % limit === 0 && allActivities.length &lt; 500);

    const recentActivities = allActivities
      .filter((a: any) =&gt; new Date(a.startTimeLocal || a.startDateLocal) &gt;= cutoffDate)
      .slice(0, 200);

    return recentActivities.map((a: any): Activity =&gt; ({
      id: a.activityId.toString(),
      startTime: a.startTimeLocal || a.startDateLocal || '',
      type: a.activityType?.name || a.activityType?.typeKey || 'Other',
      name: a.activityName || a.name || 'Unnamed Activity',
      distanceMeters: a.distance || 0,
      durationSeconds: a.duration || a.movingDuration || 0,
      calories: a.totalCalories || 0,
    }));
  }

  async getWellnessData(dateStr: string): Promise&lt;WellnessData&gt; {
    await this.ensureAuthenticated();

    const stats: any = await this.client.get_stats(dateStr);
    const hr: any = await this.client.get_heart_rates(dateStr);
    const sleep: any = await this.client.get_sleep_data(dateStr);

    return {
      restingHeartRate: hr?.resting || stats?.hr?.restingHeartRate || null,
      bodyBattery: stats?.bodyBattery ? { value: stats.bodyBattery } : null,
      sleep: sleep ? {
        duration: sleep.duration || 0,
        stages: {
          deep: sleep.deep || sleep.deepSleep || 0,
          light: sleep.light || sleep.lightSleep || 0,
          rem: sleep.rem || sleep.remSleep || 0,
          awake: sleep.awake || 0,
        },
      } : null,
      hrvStatus: stats?.hrvStatus || stats?.stress ? 'Stressed' : 'Normal',
    };
  }
}

export const garminService = new GarminService();