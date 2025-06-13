/**
 * API utility functions for interacting with the user notes backend.
 */

// Attempt to get the API base URL from environment variables,
// otherwise, assume relative paths (empty string).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export interface UserNote {
  siteCode: string;
  currentNote: string;
  versions: Array<{ note: string; timestamp: string; version: number }>;
  createdAt: string | null;
  updatedAt: string | null;
  userId?: string; // Optional, as it's primarily backend/key info
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Attempt to parse error message from backend
    const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getUserNotes(siteCode: string, idToken: string): Promise<UserNote> {
  const response = await fetch(`${API_BASE_URL}/user/notes/${siteCode}`, {
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  if (response.status === 404) {
    // As per backend logic, 404 means no notes exist, return a default empty structure
    return { siteCode, currentNote: '', versions: [], createdAt: null, updatedAt: null };
  }
  return handleResponse<UserNote>(response);
}

export async function updateUserNotes(siteCode: string, note: string, idToken: string): Promise<{ message: string, data: UserNote }> {
  const response = await fetch(`${API_BASE_URL}/user/notes/${siteCode}`, {
    method: 'POST', // or 'PUT' depending on your backend, app.py uses POST/PUT
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ note }),
  });
  return handleResponse<{ message: string, data: UserNote }>(response);
}

export async function deleteUserNotes(siteCode: string, idToken: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/user/notes/${siteCode}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  return handleResponse<{ message: string }>(response);
}

export async function undoUserNotes(siteCode: string, idToken: string): Promise<{ message: string, data: UserNote }> {
  const response = await fetch(`${API_BASE_URL}/user/notes/${siteCode}/undo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });
  return handleResponse<{ message: string, data: UserNote }>(response);
}