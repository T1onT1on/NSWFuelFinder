import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "antd/dist/reset.css";
import "./styles/index.css";

import { AppRouter } from "./router";
import { AuthProvider } from "./context/AuthContext";
import AppProviders from "./app/AppProviders";
import AuthInterceptorBridge from "./app/AuthInterceptorBridge"; // ✅ 新增

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* 挂载一次，给 apiClient 安装带 Token 与 401 自动刷新的拦截器 */}
        <AuthInterceptorBridge /> {/* ✅ 新增 */}
        <AppProviders>
          <RouterProvider router={AppRouter} />
        </AppProviders>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
