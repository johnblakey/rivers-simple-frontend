// Define interfaces for the data structures based on data.txt
export interface RiverLevel {
  id: string;
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
  comments?: string; // Optional property
  gaugeSource: string;
  highAdvisedCFS: number;
  id: number;
  localWeatherNOAA: string;
  lowAdvisedCFS: number;
  siteCode: string; // Can be an empty string
  siteName: string;
}

const BASE_API_URL = "https://api.rivers.johnblakey.org";

/**
 * Helper function to fetch JSON data from a URL.
 * @param url The URL to fetch data from.
 * @returns A promise that resolves to the JSON data.
 * @throws Will throw an error if the fetch operation fails or the response is not ok.
 */
async function fetchJSON<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} fetching from ${url}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`Error fetching JSON from ${url}:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Fetches all river details from the API.
 * @returns A promise that resolves to an array of RiverDetail objects.
 * @throws Will throw an error if the fetch operation fails.
 */
export async function getRiverDetails(): Promise<RiverDetail[]> {
  const url = `${BASE_API_URL}/riverdetails`;
  return fetchJSON<RiverDetail[]>(url);
}

/**
 * Fetches water level time series data for a specific site by its name from the API.
 * @param siteName The name of the site to fetch water levels for.
 * @returns A promise that resolves to an array of RiverLevel objects.
 * @throws Will throw an error if the fetch operation fails.
 */
export async function getRiverLevelsBySiteName(siteName: string): Promise<RiverLevel[]> {
  const encodedSiteName = encodeURIComponent(siteName);
  const url = `${BASE_API_URL}/riverlevels/sitename/${encodedSiteName}`;
  return fetchJSON<RiverLevel[]>(url);
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
