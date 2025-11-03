import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "antd/dist/reset.css";
import "./styles/index.css";

import { AppRouter } from "./router";
import { AuthProvider } from "./context/AuthContext";
import AppProviders from "./app/AppProviders"; // ⬅️ 引入

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProviders>
          <RouterProvider router={AppRouter} />
        </AppProviders>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
