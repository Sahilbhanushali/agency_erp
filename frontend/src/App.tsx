import { ThemeProvider } from "@/components/theme-provider";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LoadingProvider } from "./context/LoadingContext";
import { IsSubmittingContextProvider } from "./context/isSubmittingContext";
import { router } from "./routes/AppRoutes";

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <LoadingProvider>
        <IsSubmittingContextProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </IsSubmittingContextProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default App;
