import axios from "axios";
import type {
  InterviewReport,
  InterviewSessionOut,
  StartInterviewResponse,
} from "../types/interview";

const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL || "").replace(
  /\/$/,
  "",
);

const requireBackendBaseUrl = (): string => {
  if (!backendBaseUrl) {
    throw new Error("Missing VITE_BACKEND_URL in .env");
  }
  return backendBaseUrl;
};

const authHeaders = (accessToken: string) => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});

export const startInterview = async (params: {
  formData: FormData;
  accessToken: string;
}): Promise<StartInterviewResponse> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.post<StartInterviewResponse>(
    `${baseUrl}/interviews/start`,
    params.formData,
    {
      ...authHeaders(params.accessToken),
      // Let Axios set the proper boundary header; we just signal multipart intent.
      headers: {
        ...authHeaders(params.accessToken).headers,
        // "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
};

export const getInterviewSession = async (params: {
  sessionId: string;
  accessToken: string;
}): Promise<InterviewSessionOut> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.get<InterviewSessionOut>(
    `${baseUrl}/interviews/${params.sessionId}`,
    authHeaders(params.accessToken),
  );
  return response.data;
};

export const finishInterview = async (params: {
  sessionId: string;
  accessToken: string;
}): Promise<InterviewReport> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.post<InterviewReport>(
    `${baseUrl}/interviews/${params.sessionId}/finish`,
    {},
    authHeaders(params.accessToken),
  );
  return response.data;
};

export const getInterviewReport = async (params: {
  sessionId: string;
  accessToken: string;
}): Promise<InterviewReport> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.get<InterviewReport>(
    `${baseUrl}/interviews/${params.sessionId}/report`,
    authHeaders(params.accessToken),
  );
  return response.data;
};

