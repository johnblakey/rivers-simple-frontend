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
  gaugeName: string; // The descriptive name of the gauge, often from the source system (e.g., USGS). Not used for querying river levels via site code.
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
 * @param siteCode The site code (e.g., USGS site identifier) to fetch water levels for.
 * @returns A promise that resolves to an array of RiverLevel objects.
 * @throws Will throw an error if the fetch operation fails.
 */
export async function getRiverLevelsBySiteCode(siteCode: string): Promise<RiverLevel[]> {
  const url = `${BASE_API_URL}/riverlevels/sitecode/${siteCode}`;
  return fetchJSON<RiverLevel[]>(url);
}
