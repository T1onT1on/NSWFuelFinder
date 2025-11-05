import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import OverviewPage from "./pages/OverviewPage";
import { NearbyPage } from "./pages/NearbyPage";
import { StationDetailsPage } from "./pages/StationDetailsPage";
import UserProfilePage from "./pages/UserProfilePage";

export const AppRouter = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "nearby", element: <NearbyPage /> },
      { path: "stations/:stationCode", element: <StationDetailsPage /> },
      { path: "profile", element: <UserProfilePage /> },
      { path: "*", element: <OverviewPage /> },
    ],
  },
]);
