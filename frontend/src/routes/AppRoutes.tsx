import Login from "@/pages/auth/login/Login";
import Dashboard from "@/pages/dashboards/Dashboard";
import Company from "@/pages/setting/company/Company";
import CreateUser from "@/pages/users/create/CreateUser";
import EditUser from "@/pages/users/edit/EditUser";
import UsersList from "@/pages/users/UsersList";
import ViewProfile from "@/pages/users/view-profile/ViewProfile";
import { createBrowserRouter, Navigate } from "react-router-dom";
import NotFound from '../error/404';
import RouteErrorBoundary from "../error/RouteErrorBoundary";
import MainLayout from "../layouts/MainLayout";
import GuestRoutes from "./GuestRoutes";
import ProtectedRoutes from "./ProtectedRoutes";

export const router = createBrowserRouter([
  {
    element: <GuestRoutes />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/auth/login",
        element: <Login />,
      },
    ]
  },

  {
    element: <ProtectedRoutes />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "/dashboard", element: <Dashboard />
          },
          {
            path: "users-list", element: <UsersList />
          },
          {
            path: "users-list/create", element: <CreateUser />
          },
          {
            path: "users-list/:id", element: <ViewProfile />
          },
          {
            path: "users-list/:id/edit", element: <EditUser />
          },
          {
            path: "company", element: <Company />
          },
        ],
      },
    ]
  },

  {
    path: "*",
    element: <NotFound />,
    errorElement: <RouteErrorBoundary />,
  },
]);
