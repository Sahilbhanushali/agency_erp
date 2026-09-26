import AcceptInvite from "@/pages/auth/accept-invite/AcceptInvite";
import ForgotPassword from "@/pages/auth/forgot-password/ForgotPassword";
import ResetPassword from "@/pages/auth/reset-password/ResetPassword";
import Login from "@/pages/auth/login/Login";
import CreateClient from "@/pages/clients/create/CreateClient";
import ClientDetails from "@/pages/clients/details/ClientDetails";
import EditClient from "@/pages/clients/edit/EditClient";
import ClientsList from "@/pages/clients/ClientsList";
import CreateCompany from "@/pages/companies/create/CreateCompany";
import CompanyDetails from "@/pages/companies/details/CompanyDetails";
import EditCompany from "@/pages/companies/edit/EditCompany";
import CompaniesList from "@/pages/companies/CompaniesList";
import ApprovalsList from "@/pages/approvals/ApprovalsList";
import LeadsList from "@/pages/leads/LeadsList";
import CampaignsList from "@/pages/campaigns/CampaignsList";
import ContentCalendar from "@/pages/content/ContentCalendar";
import ContentList from "@/pages/content/ContentList";
import SocialAccountsList from "@/pages/social-accounts/SocialAccountsList";
import Dashboard from "@/pages/dashboards/Dashboard";
import InvoiceBuilder from "@/pages/invoices/builder/InvoiceBuilder";
import InvoiceDetails from "@/pages/invoices/details/InvoiceDetails";
import InvoicesList from "@/pages/invoices/InvoicesList";
import CreateProject from "@/pages/projects/create/CreateProject";
import ProjectDetails from "@/pages/projects/details/ProjectDetails";
import EditProject from "@/pages/projects/edit/EditProject";
import ProjectsList from "@/pages/projects/ProjectsList";
import QuotationBuilder from "@/pages/quotations/builder/QuotationBuilder";
import QuotationDetails from "@/pages/quotations/details/QuotationDetails";
import QuotationsList from "@/pages/quotations/QuotationsList";
import RolesList from "@/pages/roles/RolesList";
import MyTasks from "@/pages/tasks/MyTasks";
import Company from "@/pages/setting/company/Company";
import CreateUser from "@/pages/users/create/CreateUser";
import EditUser from "@/pages/users/edit/EditUser";
import UsersList from "@/pages/users/UsersList";
import ViewProfile from "@/pages/users/view-profile/ViewProfile";
import CreateWorkspace from "@/pages/workspaces/create/CreateWorkspace";
import WorkspaceDetails from "@/pages/workspaces/details/WorkspaceDetails";
import EditWorkspace from "@/pages/workspaces/edit/EditWorkspace";
import WorkspacesList from "@/pages/workspaces/WorkspacesList";
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
      {
        path: "/auth/accept-invite",
        element: <AcceptInvite />,
      },
      {
        path: "/auth/forgot-password",
        element: <ForgotPassword />,
      },
      {
        path: "/auth/reset-password",
        element: <ResetPassword />,
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
            path: "tasks", element: <MyTasks />
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
            path: "view-profile", element: <ViewProfile />
          },
          {
            path: "roles-list", element: <RolesList />
          },
          {
            path: "company", element: <Company />
          },
          {
            path: "clients-list", element: <ClientsList />
          },
          {
            path: "clients-list/create", element: <CreateClient />
          },
          {
            path: "clients-list/:id/edit", element: <EditClient />
          },
          {
            path: "clients-list/:id", element: <ClientDetails />
          },
          {
            path: "projects-list", element: <ProjectsList />
          },
          {
            path: "campaigns-list", element: <CampaignsList />
          },
          {
            path: "content", element: <ContentList />
          },
          {
            path: "content/calendar", element: <ContentCalendar />
          },
          {
            path: "social-accounts", element: <SocialAccountsList />
          },
          {
            path: "approvals", element: <ApprovalsList />
          },
          {
            path: "leads", element: <LeadsList />
          },
          {
            path: "projects-list/create", element: <CreateProject />
          },
          {
            path: "projects-list/:id/edit", element: <EditProject />
          },
          {
            path: "projects-list/:id", element: <ProjectDetails />
          },
          {
            path: "workspaces-list", element: <WorkspacesList />
          },
          {
            path: "workspaces-list/create", element: <CreateWorkspace />
          },
          {
            path: "workspaces-list/:id/edit", element: <EditWorkspace />
          },
          {
            path: "workspaces-list/:id", element: <WorkspaceDetails />
          },
          {
            path: "companies-list", element: <CompaniesList />
          },
          {
            path: "companies-list/create", element: <CreateCompany />
          },
          {
            path: "companies-list/:id/edit", element: <EditCompany />
          },
          {
            path: "companies-list/:id", element: <CompanyDetails />
          },
          {
            path: "quotations-list", element: <QuotationsList />
          },
          {
            path: "quotations-list/create", element: <QuotationBuilder />
          },
          {
            path: "quotations-list/:id/edit", element: <QuotationBuilder />
          },
          {
            path: "quotations-list/:id", element: <QuotationDetails />
          },
          {
            path: "invoices-list", element: <InvoicesList />
          },
          {
            path: "invoices-list/create", element: <InvoiceBuilder />
          },
          {
            path: "invoices-list/:id/edit", element: <InvoiceBuilder />
          },
          {
            path: "invoices-list/:id", element: <InvoiceDetails />
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
