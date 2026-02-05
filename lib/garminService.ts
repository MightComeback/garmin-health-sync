/**
 * Garmin Connect API Service
 * Handles authentication and data fetching via reverse-engineered API
 * Reference: python-garminconnect (cyberjunky/python-garminconnect)
 */

export interface Activity {
  summary: {
    totalCalories: number;
    movingDuration: number;
  };
  startDateLocal: string;
}

export interface SleepData {
  duration: number;
  stages: {
    deep: number;
    light: number;
    rem: number;
    awake: number;
  };
}

export interface HRVData {
  status: string;
  value: number;
}

export interface BodyBatteryData {
  value: number;
}

export interface WellnessData {
  restingHeartRate: number | null;
  sleep: SleepData | null;
  hrvStatus: string | null;
  bodyBattery: BodyBatteryData | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface ActivityList {
  userId?: string;
  activities: Activity[];
}

interface DailyStats {
  steps?: number;
  activeZoneMinutes?: any;
  sleep?: {
    summary: {
      stages: {
        deep?: number;
        deepRem?: number;
        deepSleep?: number;
        lie?: number;
        rem?: number;
        remStages?: number;
        remSleep?: number;
        light?: number;
        lightStages?: number;
        lightSleep?: number;
        awake?: number;
        awakeStages?: number;
      };
      totalDuration: number;
    };
    endTime: number;
    startTime: number;
  };
  hr?: {
    zones: {
      maximum: number;
      peak: number;
      cardio: number;
    };
  };
  stress?: number;
  sleepScore?: number;
}

export class GarminService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: Date | null = null;
  private readonly AUTH_URL = 'https://connectapi.garmin.com/auth/oauth';
  private readonly API_URL = 'https://connectapi.garmin.com/connect-api';
  private readonly BASE_URL = 'https://connect.garmin.com/modern';
  private email: string | null = null;
  private password: string | null = null;
  private authTokens: Record<string, AuthTokens> = {};

  isAuthenticated(): boolean {
    return this.accessToken && this.expiresAt ? new Date() < this.expiresAt : false;
  }

  async login(email: string, password: string): Promise<void> {
    this.email = email;
    this.password = password;

    // Basic auth header for login
    const auth = Buffer.from(`${email}:${password}`).toString('base64');
    const loginUrl = `${this.BASE_URL}/user/profile`;
    const payload = {
      verifyCode: '',
      password: password,
      rememberMe: 'true',
      deviceId: generateDeviceId(),
      joinLoyaltyProgram: 'false',
    };

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as string;
    this.accessToken = data;

    // Set 8-hour expiration
    this.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  getAuthorizationUrl(): string {
    // Legacy OAuth flow (replaced by email/password login)
    return 'https://health-profile.garmin.com/profile/auth/v3/webClient/authorize';
  }

  async exchangeCodeForTokens(code: string): Promise<void> {
    throw new Error('OAuth 2.0 flow is not used. Please use login() with email/password instead.');
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.email = null;
    this.password = null;
  }

  private async ensureAuthenticated(): void {
    if (!this.isAuthenticated()) {
      if (!this.email || !this.password) {
        throw new Error('Not authenticated. Call login() with email and password first.');
      }
      await this.login(this.email, this.password);
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown): Promise<any> {
    this.ensureAuthenticated();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    };

    const config: RequestInit = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const response = await fetch(`${this.API_URL}${endpoint}`, config);

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refreshing
        await this.refreshAccessToken();
        return this.makeRequest(endpoint, method, body);
      }
      throw new Error(`Garmin API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.email || !this.password) {
      throw new Error('Cannot refresh token: credentials not available');
    }

    // Re-login to get fresh token
    await this.login(this.email, this.password);
  }

  async getActivities(days: number = 30): Promise<Activity[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Get user ID first
    const userResponse = await this.makeRequest('/user/profile-service/useractivity-summary/byDate/' + startStr);
    const userId = userResponse.userId;

    if (!userId) {
      throw new Error('Unable to retrieve user ID');
    }

    // Get activities using user activity summary endpoint
    const activityUrl = `${this.API_URL}/useractivity-service/useractivity-summary/activity-list/${userId}`;
    const activityPayload = {
      activityType: 'All',
      dateStyle: 'TODAY',
      editLink: false,
      endTimeLocal: endStr,
      findActivityType: 'All',
      interval: 'day',
      locale: 'en-US',
      nextPageToken: '',
      pageTitle: 'Activities',
      previousPageToken: '',
      requirement: 'statsSummary',
      responseType: 'summary',
      startTimeLocal: startStr,
      syncUserProfileActivities: false,
    };

    const activityData = await this.makeRequest(activityUrl, 'POST', activityPayload);
    const activities = (activityData.activitySummaries || []) as Activity[];

    return activities;
  }

  async getWellnessData(dateStr: string): Promise<WellnessData> {
    const date = new Date(dateStr);
    const dateParts = date.toISOString().split('T');
    const dateComps = `${dateParts[0]} ${dateParts[1].split('.')[0]}:00:00`;

    // Get daily stats via user activity summary
    const statsUrl = `${this.API_URL}/useractivity-service/useractivity-summary/byDate/${dateParts[0]}`;

    try {
      const statsData: DailyStats = await this.makeRequest(statsUrl);

      return {
        restingHeartRate: this.parseHeartRate(statsData.hr?.zones),
        sleep: this.parseSleep(statsData.sleep),
        hrvStatus: statsData.stress ? 'Stressed' : 'Normal',
        bodyBattery: statsData.sleepScore !== undefined ? { value: Math.round(statsData.sleepScore) } : null,
      };
    } catch (error) {
      console.error(`Error fetching wellness data for ${dateStr}:`, error);
      throw error;
    }
  }

  private parseHeartRate(zones?: any): number | null {
    if (!zones) return null;
    if (zones.cardio !== undefined) return zones.cardio;
    if (zones.peak !== undefined) return zones.peak;
    return zones.maximum || null;
  }

  private parseSleep(sleepData?: DailyStats['sleep']): WellnessData['sleep'] | null {
    if (!sleepData?.summary?.totalDuration) return null;

    return {
      duration: sleepData.summary.totalDuration,
      stages: {
        deep: sleepData.summary.stages?.deep || 0,
        light: sleepData.summary.stages?.light || 0,
        rem: sleepData.summary.stages?.rem || 0,
        awake: sleepData.summary.stages?.awake || 0,
      },
    };
  }
}

// Helper function to generate device ID for Garmin login
function generateDeviceId(): string {
  // Generate a random device ID similar to iOS devices
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += '-';
    } else {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

export const garminService = new GarminService();
