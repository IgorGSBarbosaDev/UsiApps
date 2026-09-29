import demo from "@/data/synthetic-preview.json";
import type { DashboardPayload } from "./types";

declare global {
  interface Window {
    google?: {
      script?: {
        run: AppsScriptRunner;
      };
    };
  }
}

type AppsScriptRunner = {
  withSuccessHandler: (callback: (value: DashboardPayload) => void) => AppsScriptRunner;
  withFailureHandler: (callback: (error: { message?: string }) => void) => AppsScriptRunner;
          getDashboardData: () => void;
};

export const previewMode = import.meta.env.MODE === "preview";

export function loadDashboardData(): Promise<DashboardPayload> {
  if (previewMode) {
    return Promise.resolve({
      ...demo,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1LU6Vej6ZgEx_urYH-I4JyDss2Tl8fsWNc2NvZAtIBdw/edit",
      updatedAt: "Amostra local",
      sourceLabel: "Demonstração · dados simulados",
    } as DashboardPayload);
  }

  return new Promise((resolve, reject) => {
    const runner = window.google?.script?.run;
    if (!runner) {
      reject(new Error("O Apps Script não respondeu. Abra o painel pelo link de implantação ou pela planilha GT/GP."));
      return;
    }
    runner
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => reject(new Error(error?.message || "Não foi possível ler as abas da planilha.")))
      .getDashboardData();
  });
}
