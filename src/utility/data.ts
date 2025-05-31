import { Datastore } from '@google-cloud/datastore';

// Define interfaces for the data structures based on data.txt
export interface RiverLevel {
  value: number;
  variableCode: string;
  siteCode: string;
  timestamp: string; // ISO Date string
  unitCode: string;
  siteName: string;
  expireAt: string; // ISO Date string
}

export interface RiverDetail {
  americanWhitewaterLink: string;
  gaugeSource: string;
  highAdvisedCFS: number;
  localWeatherNOAA: string;
  lowAdvisedCFS: number;
  siteCode: string; // Can be an empty string
  siteName: string;
  comments?: string; // Optional property
}

// Environment variables from process.env
// Ensure these are set in your execution environment (e.g., .env file with dotenv, or system environment variables)
const PROJECT_ID = process.env.PROJECT_ID;
const WATER_LEVEL_KIND = process.env.WATER_LEVEL_KIND;
const RIVER_DETAILS_KIND = process.env.RIVER_DETAILS_KIND;
const NAMESPACE = process.env.DATASTORE_NAMESPACE;

// Validate that environment variables are set
if (!PROJECT_ID) {
  throw new Error("PROJECT_ID environment variable is not set.");
}
if (!WATER_LEVEL_KIND) {
  throw new Error("WATER_LEVEL_KIND environment variable is not set.");
}
if (!RIVER_DETAILS_KIND) {
  throw new Error("RIVER_DETAILS_KIND environment variable is not set.");
}
if (!NAMESPACE) {
  throw new Error("DATASTORE_NAMESPACE environment variable is not set.");
}

const datastoreClient = new Datastore({
  projectId: PROJECT_ID,
  namespace: NAMESPACE,
});

/**
 * Fetches all river details from Google Cloud Datastore.
 * @returns A promise that resolves to an array of RiverDetail objects.
 * @throws Will throw an error if the query fails or RIVER_DETAILS_KIND is not set.
 */
export async function getRiverDetails(): Promise<RiverDetail[]> {
  const query = datastoreClient.createQuery(RIVER_DETAILS_KIND);

  try {
    const [entities] = await datastoreClient.runQuery(query);
    return entities as RiverDetail[]; // Assuming entities match the RiverDetail interface
  } catch (error) {
    console.error('Datastore error in getRiverDetails:', error);
    throw new Error(`Error fetching river details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetches water level time series data from Google Cloud Datastore for the last 7 days.
 * Timestamps are ordered descending (most recent first).
 * @returns A promise that resolves to an array of RiverLevel objects.
 * @throws Will throw an error if the query fails or WATER_LEVEL_KIND is not set.
 */
export async function getWaterLevels(): Promise<RiverLevel[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  const query = datastoreClient.createQuery(WATER_LEVEL_KIND)
    .filter('timestamp', '>=', startDate.toISOString()) // Use ISOString for string comparison if timestamp is stored as string
    .filter('timestamp', '<=', endDate.toISOString())   // Or pass Date objects if timestamp is a Datastore Timestamp type
    .order('timestamp', { descending: true });

  try {
    const [entities] = await datastoreClient.runQuery(query);
    return entities as RiverLevel[]; // Assuming entities match the RiverLevel interface
  } catch (error) {
    console.error('Datastore error in getWaterLevels:', error);
    throw new Error(`Error fetching water levels: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Formats a date-time string, number, or Date object into MM-DD-YYYY HH:MM format.
 * @param dateTime The date-time to format.
 * @returns The formatted date-time string.
 */
export const formatDate = (dateTime: string | number | Date): string => {
  const date = new Date(dateTime);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}-${day}-${year} ${hours}:${minutes}`;
};