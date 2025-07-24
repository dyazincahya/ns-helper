import { Http } from "@klippa/nativescript-http";
import { ApplicationSettings } from "@nativescript/core";
import { SecureStorage } from "@nativescript/secure-storage";

// --- Configuration ---
const END_POINT = global.baseUrl;
const TOKEN_KEY = global.tokenKey;

function isCacheValid(cacheDateStr, maxAgeInDays) {
  if (!cacheDateStr || typeof cacheDateStr !== "string") return false; // Pastikan cacheDateStr adalah string
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cacheDate = new Date(cacheDateStr);
  cacheDate.setHours(0, 0, 0, 0);
  const diffTime = today - cacheDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < maxAgeInDays;
}

/**
 * Internal function to perform an HTTP request.
 * Used by GET, POST, and other related functions.
 */
async function _httpRequest(path, method, data = null) {
  const requestUrl = path.startsWith("http") ? path : END_POINT + path;
  const noToken = data && data.noToken;

  if (noToken) {
    delete data.noToken;
  }

  try {
    const requestOptions = {
      method: method,
      url: requestUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: getToken(),
      },
      content: data ? JSON.stringify(data) : undefined,
    };

    if (noToken) {
      delete requestOptions.headers.Authorization;
    }
    const res = await Http.request(requestOptions);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (res.content) {
        try {
          return JSON.parse(res.content.toString());
        } catch (e) {
          // Log error parsing JSON but still return content as string
          console.warn("Failed to parse JSON, returning as plain text:", e);
          return res.content.toString(); // Return as plain text if not JSON
        }
      }
      return null;
    } else {
      throw new Error(`Server responded with status ${res.statusCode}`);
    }
  } catch (e) {
    console.error("ApiService Request Error:", e);
    throw e;
  } finally {
  }
}

// --- Public API ---

/**
 * Melakukan GET request dengan logika caching terintegrasi.
 * @param {string} path - Path atau URL lengkap.
 * @param {object} options - Opsi untuk caching.
 * @param {boolean} [options.useCache=false] - Set true untuk mengaktifkan cache.
 * @param {string} [options.cacheKey] - Kunci unik untuk cache (wajib jika useCache=true).
 * @param {number} [options.maxAgeInDays=1] - Masa berlaku cache.
 * @param {boolean} [options.forceFetch=false] - Paksa fetch data baru.
 * @returns {Promise<any>}
 */
export async function get(path, options = {}) {
  const {
    useCache = false,
    cacheKey,
    maxAgeInDays = 1,
    forceFetch = false,
  } = options;

  if (!useCache) {
    return _httpRequest(path, "GET", options);
  }

  if (!cacheKey) {
    // cacheKey = path.replace(/\//g, "_");
    throw new Error(
      "[ApiService] `cacheKey` is required when `useCache` is true."
    );
  }

  const dataKey = `cache_data_${cacheKey}`;
  const dateKey = `cache_date_${cacheKey}`;

  // Memastikan mendapatkan string atau null
  const cachedDataStr = ApplicationSettings.getString(dataKey) || null;
  const cachedDate = ApplicationSettings.getString(dateKey) || null;

  if (!forceFetch && isCacheValid(cachedDate, maxAgeInDays) && cachedDataStr) {
    console.log(`[ApiService] Menggunakan cache untuk kunci: "${cacheKey}"`);
    try {
      return JSON.parse(cachedDataStr);
    } catch (e) {
      console.error(
        `[ApiService] Gagal mem-parse cached data untuk kunci "${cacheKey}":`,
        e
      );
      // Jika cache rusak, perlakukan seolah-olah tidak ada cache yang valid
      ApplicationSettings.remove(dataKey);
      ApplicationSettings.remove(dateKey);
    }
  }

  try {
    console.log(`[ApiService] Fetching data baru untuk kunci: "${cacheKey}"`);
    const newData = await _httpRequest(path, "GET", null);

    // Simpan data baru ke cache
    // Pastikan newData adalah objek atau array sebelum di-stringify
    if (typeof newData === "object" && newData !== null) {
      ApplicationSettings.setString(dataKey, JSON.stringify(newData));
    } else {
      // Jika newData bukan objek/array (misal: string kosong, null), simpan sebagai string biasa jika perlu
      ApplicationSettings.setString(dataKey, String(newData));
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    ApplicationSettings.setString(dateKey, todayStr);

    return newData;
  } catch (error) {
    console.error(
      `[ApiService] Gagal fetch, mencoba fallback ke cache lama untuk kunci: "${cacheKey}"`
    );
    // --- PERBAIKAN 2: Pastikan cachedDataStr adalah string sebelum di-parse ---
    if (cachedDataStr && typeof cachedDataStr === "string") {
      try {
        return JSON.parse(cachedDataStr);
      } catch (parseError) {
        console.error(
          `[ApiService] Gagal mem-parse fallback cache untuk kunci "${cacheKey}":`,
          parseError
        );
        // Jika fallback cache rusak, hapus dan throw error asli
        ApplicationSettings.remove(dataKey);
        ApplicationSettings.remove(dateKey);
        throw error; // Throw the original fetch error
      }
    }
    // Jika fetch gagal dan tidak ada cache sama sekali atau cache rusak
    throw error;
  }
}

/**
 * Performs a POST request (usually not cached).
 * @param {string} path - Path or full URL.
 * @param {object} data - The body/payload of the request.
 */
export function post(path, data) {
  return _httpRequest(path, "POST", data);
}

/**
 * Performs a PUT request (usually not cached).
 * @param {string} path - Path or full URL.
 * @param {object} data - The body/payload of the request.
 */

export function put(path, data) {
  return _httpRequest(path, "PUT", data);
}

/**
 * Performs a DELETE request (usually not cached).
 * @param {string} path - Path or full URL.
 * @param {object} data - The body/payload of the request.
 */
export function del(path, data) {
  return _httpRequest(path, "DELETE", data);
}

export function getCacheKeys() {
  // Mengambil semua kunci cache yang ada
  return ApplicationSettings.getAllKeys().filter((key) =>
    key.startsWith("cache_data_")
  );
}

export function getCacheDateKeys() {
  // Mengambil semua kunci tanggal cache yang ada
  return ApplicationSettings.getAllKeys().filter((key) =>
    key.startsWith("cache_date_")
  );
}

export function hasCache(key) {
  const dataKey = `cache_data_${key}`;
  return ApplicationSettings.hasKey(dataKey);
}

export function getCache(key) {
  const dataKey = `cache_data_${key}`;
  return ApplicationSettings.getString(dataKey) || null;
}

export function getCacheDate(key) {
  const dateKey = `cache_date_${key}`;
  return ApplicationSettings.getString(dateKey) || null;
}

/**
 * Membersihkan cache tertentu secara manual.
 * @param {string} key - Kunci unik cache yang akan dihapus.
 */
export function clearCache(key) {
  const dataKey = `cache_data_${key}`;
  const dateKey = `cache_date_${key}`;

  if (!ApplicationSettings.hasKey(dataKey)) {
    console.warn(
      `[ApiService] Tidak ada cache untuk kunci "${key}" yang ditemukan.`
    );
    return;
  }

  // Hapus data dan tanggal cache
  ApplicationSettings.remove(dataKey);
  ApplicationSettings.remove(dateKey);
  console.log(`[ApiService] Cache untuk kunci "${key}" telah dibersihkan.`);
}

export function getToken() {
  const secureStorage = new SecureStorage();
  let token = secureStorage.getSync({
    key: "token",
  });

  if (!token) {
    secureStorage.setSync({
      key: "token",
      value: `Bearer ${atob(TOKEN_KEY)}`,
    });
    token = secureStorage.getSync({
      key: "token",
    });
  }

  return token;
}
