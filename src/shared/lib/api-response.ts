/**
 * Standard API response type for consistent error handling
 * 
 * All repository and service functions should return ApiResponse<T>
 * to ensure consistent error handling across the application.
 */

export type ApiOk<T> = {
  ok: true;
  data: T;
};

export type ApiErr = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiOk<T> | ApiErr;

/**
 * Helper function to create a successful API response
 */
export function apiOk<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

/**
 * Helper function to create an error API response
 */
export function apiErr(code: string, message: string, details?: unknown): ApiErr {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * Helper function to check if a response is successful
 */
export function isApiOk<T>(response: ApiResponse<T>): response is ApiOk<T> {
  return response.ok === true;
}

/**
 * Helper function to check if a response is an error
 */
export function isApiErr<T>(response: ApiResponse<T>): response is ApiErr {
  return response.ok === false;
}



